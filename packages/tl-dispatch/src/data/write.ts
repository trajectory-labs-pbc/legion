import {
  type InferDataFromTag,
  type QueryClient,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiError, replaceQueryData } from "@/upstream/api";
import {
  isConflict,
  type KeyedWriteOptions,
  SendStoppedError,
  stoppedNote,
  useKeyedWrite,
} from "@/upstream/writes";
import type { WriteFailureText } from "@/writes/write-failure-note";

/** One query a write's value stands in while it is out, and the change it makes there. */
export interface Patch {
  readonly key: QueryKey;
  /** Cancels the key's read in flight, then writes the value over what the key holds. */
  readonly apply: (client: QueryClient) => void;
}

/** The patch of `key`: `update` takes what the key holds and gives what stands in for it. */
export function patch<TKey extends QueryKey>(
  key: TKey,
  update: (
    current: InferDataFromTag<unknown, TKey> | undefined
  ) => InferDataFromTag<unknown, TKey> | undefined
): Patch {
  return { key, apply: (client) => void replaceQueryData(client, key, update) };
}

/** Each key a press patched, whether the patch gave it its first value, and the value it wrote. */
type Patched = readonly {
  readonly key: QueryKey;
  readonly created: boolean;
  readonly written: unknown;
}[];

/**
 * Upstream's keyed write options, but the helper owns the optimistic value and its failure: the
 * caller gives `optimistic` and `text`, and no `onMutate`, `onError` or `holds`.
 */
export type WriteOptions<TData, TVariables> = KeyedWriteOptions<TData, TVariables, Patched> & {
  /** Whether the write's own place shows its failure, rather than upstream's indicator. */
  readonly inline: boolean | ((variables: TVariables) => boolean);
  /** The queries the write's value stands in while it is out. */
  readonly optimistic?: (variables: TVariables) => readonly Patch[];
  /** What a failure of the press says, in the reader's words; Retry makes the same press again. */
  readonly text: (variables: TVariables) => Omit<WriteFailureText, "anew">;
  readonly onMutate?: never;
  readonly onError?: never;
  readonly holds?: never;
};

/** A failed press as the toast shows it. */
export interface WriteToast {
  readonly text: string;
  /** Absent where trying again cannot land. */
  readonly retry: (() => void) | undefined;
}

/** A write of a record as a view uses it. */
export interface RecordWrite<TVariables> {
  readonly run: (variables: TVariables) => void;
  /** Out, late ones included: upstream's store keeps trying a write with no verdict. */
  readonly pending: boolean;
  /** Dispatch refused the newest press. */
  readonly refusal: Error | undefined;
  /** The newest press ended with no verdict, so it may have been made. */
  readonly unconfirmed: SendStoppedError | undefined;
  /** What the toast says of the newest press's failure. */
  readonly failure: WriteToast | undefined;
}

/** Whether trying again can land: not for a 403, a 404 or a conflict only the reader settles. */
function curable(error: Error): boolean {
  const final = error instanceof ApiError && (error.status === 403 || error.status === 404);
  return !final && !isConflict(error);
}

/**
 * One write through upstream's keyed write. Its patches cancel their keys' reads in flight and
 * stand in while it is out; reads asked meanwhile wait (upstream's `holdBackReads`). Once it ends
 * either way its keys are read again, which puts the server's state back after a failure without
 * undoing another write of the same key; a key that held nothing before a failed press holds
 * nothing again, unless a newer press wrote it since.
 */
export function useWrite<TData, TVariables = void>(
  options: WriteOptions<TData, TVariables>
): RecordWrite<TVariables> {
  const client = useQueryClient();
  const { onSettled, optimistic, text } = options;
  const keysOf = (variables: TVariables) => (optimistic?.(variables) ?? []).map((each) => each.key);
  const write = useKeyedWrite<TData, TVariables, Patched>({
    ...options,
    ...(optimistic === undefined
      ? {}
      : {
          holds: (variables: TVariables) => ({ keys: keysOf(variables) }),
          onMutate: (variables: TVariables) =>
            optimistic(variables).map((each) => {
              const created = client.getQueryData(each.key) === undefined;
              each.apply(client);
              return { key: each.key, created, written: client.getQueryData(each.key) };
            }),
        }),
    onSettled: (data, error, variables, result, context) => {
      // After a failure a key no view reads is read again too, so none keeps the refused value.
      const refetchType = error === null ? "active" : "all";
      for (const { key: queryKey, created, written } of result ?? []) {
        // A key the press gave its first value holds none again, unless a newer press wrote it.
        const own = created && client.getQueryData(queryKey) === written;
        void (error !== null && own
          ? client.resetQueries({ exact: true, queryKey })
          : client.invalidateQueries({ exact: true, queryKey, refetchType }));
      }
      return onSettled?.(data, error, variables, result, context);
    },
  });
  const { error } = write;
  const failure = (variables: TVariables, failed: Error): WriteToast => {
    const { what, refused } = text(variables);
    return {
      text: stoppedNote(write, what, "made") ?? refused(failed),
      retry: curable(failed) ? write.retry : undefined,
    };
  };
  return {
    run: write.mutate,
    pending: write.isPending,
    refusal: error === null || error instanceof SendStoppedError ? undefined : error,
    unconfirmed: error instanceof SendStoppedError ? error : undefined,
    failure: write.isError ? failure(write.variables, write.error) : undefined,
  };
}
