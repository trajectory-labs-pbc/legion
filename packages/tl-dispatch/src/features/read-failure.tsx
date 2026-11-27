import { NO_ROUTE_ROLLING_RELEASE_MESSAGE } from "@legion/contracts";
import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiError, isNoRoute } from "@upstream-dispatch/api/client";
import { queryRetry } from "@upstream-dispatch/api/query-client";
import { useLayoutEffect, useRef, useState } from "react";

/** Why asking a read again cannot change its answer: a 403 or a 404. */
export type Refusal = "forbidden" | "not-found";

/** Reads that failed: refused for good, or worth a Retry. */
export type ReadFault =
  | { refusal: Refusal }
  | {
      refusal?: undefined;
      /** Their Retry is out: the failure stays, and its Retry shows it is busy. */
      retrying: boolean;
      retry: () => void;
    };
export type RetryableFault = Exclude<ReadFault, { refusal: Refusal }>;

/** What a fault reads of a read: a query result, or a query's state with its Retry. */
type FailableRead = Pick<
  UseQueryResult<unknown>,
  "data" | "error" | "errorUpdateCount" | "errorUpdatedAt" | "isFetching" | "isPlaceholderData"
> & { refetch: () => unknown };

/** A read with nothing of its own to show: no data, or another key's placeholder. */
const unanswered = (read: FailableRead) => read.data === undefined || read.isPlaceholderData;

/**
 * The one sort of a failed read. A 404 from a Dispatch process with no route for the read is no
 * refusal: while a release rolls out, another process can answer it.
 */
export function refusalOf(error: unknown): Refusal | undefined {
  if (!(error instanceof ApiError) || isNoRoute(error)) return undefined;
  if (error.message === NO_ROUTE_ROLLING_RELEASE_MESSAGE) return undefined;
  if (error.status === 403) return "forbidden";
  return error.status === 404 ? "not-found" : undefined;
}

/** Every read's retry policy: upstream's, which never asks a refused read again by itself. */
export function readRetry(failureCount: number, error: unknown): boolean {
  return refusalOf(error) === undefined && queryRetry(failureCount, error);
}

/** `reads` that failed with nothing to show, each with its refusal, if any. */
function faultOf(
  reads: readonly FailableRead[],
  refusals: readonly (Refusal | undefined)[]
): ReadFault | undefined {
  // A Retry puts a read back to pending, so the error count is what says it failed before.
  const failed = reads.flatMap((read, index) =>
    unanswered(read) && read.errorUpdateCount > 0 ? [index] : []
  );
  if (failed.length === 0) return undefined;
  const refused = failed.map((index) => refusals[index]);
  if (!refused.includes(undefined)) {
    return { refusal: refused.includes("forbidden") ? "forbidden" : "not-found" };
  }
  // A failure that trying again can clear wins, so its Retry shows.
  return {
    retrying: failed.some((index) => reads[index]?.isFetching === true),
    // Every read is asked again, so what they make together comes from one round.
    retry: () => {
      for (const read of reads) void read.refetch();
    },
  };
}

/** A read's refusal, with the time of the error it came from. */
type Kept = { at: number; refusal: Refusal | undefined };

/** Reads that failed with nothing to show; a refusal stays only while its own query is re-asked. */
export function useReadFailure(...reads: readonly FailableRead[]): ReadFault | undefined {
  const [kept, setKept] = useState<readonly Kept[]>([]);
  const current = reads.map((read, index): Kept => {
    const at = read.errorUpdatedAt;
    if (read.error !== null) return { at, refusal: refusalOf(read.error) };
    const last = kept[index];
    const again = unanswered(read) && read.isFetching && last?.at === at;
    return { at, refusal: again ? last.refusal : undefined };
  });
  const changed = current.some(
    (each, index) => each.at !== kept[index]?.at || each.refusal !== kept[index]?.refusal
  );
  if (current.length !== kept.length || changed) setKept(current);
  return faultOf(
    reads,
    current.map((each) => each.refusal)
  );
}

/** A read whose refresh failed under what it shows, if so; the failure stays while its Retry runs. */
export function refreshFailureOf(read: UseQueryResult<unknown>): ReadFault | undefined {
  if (!read.isRefetchError) return undefined;
  const refusal = refusalOf(read.error);
  if (refusal !== undefined) return { refusal };
  return { retrying: read.isFetching, retry: () => void read.refetch() };
}

function lineOf(fault: ReadFault, noun: string, refresh: boolean): string {
  if (refresh) {
    if (fault.refusal === undefined) return `Could not refresh ${noun}.`;
    return `Could not refresh ${noun}: ${fault.refusal === "forbidden" ? "access refused" : "not found"}.`;
  }
  if (fault.refusal === undefined) return `Could not load ${noun}.`;
  return fault.refusal === "forbidden" ? `You cannot see ${noun}.` : `Could not find ${noun}.`;
}

/**
 * A failed read, announced: Retry, which keeps the focus while it runs, or no Retry for a refusal.
 * A refusal that answers a Retry takes the focus the Retry had.
 */
export function ReadFailure({
  fault,
  noun,
  refresh = false,
  size = "compact",
}: {
  fault: ReadFault;
  noun: string;
  /** The read failed under rows it still shows. */
  refresh?: boolean;
  /** `default` where the failure stands for a whole page. */
  size?: "default" | "compact";
}) {
  const alert = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const retryHadFocus = useRef(false);
  const refused = fault.refusal !== undefined;
  useLayoutEffect(() => {
    const active = document.activeElement;
    const lost = active === null || active === document.body || !active.isConnected;
    if (refused && retryHadFocus.current && lost) alert.current?.focus();
    retryHadFocus.current = !refused && document.activeElement === retry.current;
  });
  return (
    <Alert
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      ref={alert}
      size={size}
      tabIndex={refused ? -1 : undefined}
      variant="danger"
    >
      <AlertTitle>{lineOf(fault, noun, refresh)}</AlertTitle>
      {fault.refusal === undefined ? (
        <AlertAction>
          <Button
            loading={fault.retrying}
            onClick={fault.retry}
            ref={retry}
            size={size === "compact" ? "xs" : "sm"}
            variant="outline"
          >
            Retry
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
