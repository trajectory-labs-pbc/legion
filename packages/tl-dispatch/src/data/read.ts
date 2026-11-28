import {
  type DefaultError,
  hashKey,
  type QueryKey,
  type UseQueryOptions,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, NO_ROUTE_ROLLING_RELEASE_MESSAGE, queryRetry } from "@/upstream/api";

/** Why asking a read again cannot change its answer: a 403 or a 404. */
export type Refusal = "forbidden" | "not-found";

/** A read that failed and can be tried again; the failure stays while it is read again. */
export interface RetryableFault {
  /** It is being read again: the failure stays, and its Retry shows it is busy. */
  readonly retrying: boolean;
  readonly retry: () => void;
  readonly refusal?: undefined;
}

/** A read Dispatch refused for good: the reader may not see it, or it is gone. */
export interface RefusedFault {
  /** It is being read again, though no Retry of the reader's asked. */
  readonly retrying: boolean;
  readonly retry?: undefined;
  readonly refusal: Refusal;
}

export type ReadFault = RetryableFault | RefusedFault;

/** A read as a view draws it: nothing yet, a failure, or the data. */
export type Read<T, E = DefaultError> =
  | { readonly state: "loading" }
  | ({
      readonly state: "error";
      /** Why it failed; `null` while a Retry of a failure that can be tried again runs. */
      readonly error: E | null;
    } & ReadFault)
  | {
      readonly state: "ready";
      readonly data: T;
      /** Why the last refresh failed, while the data it could not replace stays. */
      readonly refreshError: E | undefined;
    };

export interface ReadOptions<TQueryFnData, T> {
  /** Shapes the data for this reader alone. */
  readonly select?: (data: TQueryFnData) => T;
}

/**
 * Whether a failed read is refused, which decides whether it offers Retry. The 404 the client
 * answers once a route stayed missing through its retries is no refusal: while a release rolls
 * out, another process can answer it. A read's 409 keeps its Retry: the conflict rule is for
 * writes.
 */
export function refusalOf(error: unknown): Refusal | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.message === NO_ROUTE_ROLLING_RELEASE_MESSAGE) return undefined;
  if (error.status === 403) return "forbidden";
  return error.status === 404 ? "not-found" : undefined;
}

/** Every read's retry policy: upstream's, except that it never asks a refused read again by itself. */
export function readRetry(failureCount: number, error: unknown): boolean {
  return refusalOf(error) === undefined && queryRetry(failureCount, error);
}

/** A read with nothing to show in one place: how it failed, whether it is out, which query it is. */
type FailurePlace<F> =
  | { readonly failure: F | undefined; readonly out: boolean; readonly query?: string }
  | undefined;

/**
 * How each place's read last failed, as this view saw it. A refetch clears the error of a read
 * with no data until it answers, so a failure stays while the same query is out again, however
 * often it failed meanwhile; a read this view never saw fail has none while it is out.
 */
export function useKeptFailures<F>(places: readonly FailurePlace<F>[]): readonly (F | undefined)[] {
  const [seen, setSeen] = useState<readonly FailurePlace<F>[]>([]);
  const kept = places.map((place, index) => {
    const before = seen[index];
    if (place?.failure !== undefined || !place?.out || before?.query !== place.query) return place;
    return { ...place, failure: before?.failure };
  });
  const changed = (place: FailurePlace<F>, index: number) =>
    place?.failure !== seen[index]?.failure ||
    (place?.failure !== undefined && place.query !== seen[index]?.query);
  if (kept.some(changed)) setSeen(kept);
  return kept.map((place) => place?.failure);
}

/**
 * Reads `options` as upstream gives them, under their key, so upstream's event refresh and its
 * widgets share the cache entry.
 */
export function useRead<TQueryFnData, TError, TQueryKey extends QueryKey, T = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, TError, TQueryFnData, TQueryKey>,
  { select }: ReadOptions<TQueryFnData, T> = {}
): Read<T, TError> {
  const query = useQuery<TQueryFnData, TError, T, TQueryKey>({ ...options, select });
  const empty = query.isPending || query.isLoadingError;
  const [error] = useKeptFailures([
    empty
      ? {
          failure: query.error ?? undefined,
          out: query.fetchStatus !== "idle",
          query: hashKey(options.queryKey),
        }
      : undefined,
  ]);
  if (empty) {
    // A view that mounts on a failed read, or moves to one, saw no failure of it yet.
    if (error === undefined) return { state: "loading" };
    const retrying = query.fetchStatus !== "idle";
    const refusal = refusalOf(error);
    return refusal === undefined
      ? { state: "error", error: query.error, retrying, retry: () => void query.refetch() }
      : { state: "error", error, retrying, refusal };
  }
  return {
    state: "ready",
    data: query.data,
    refreshError: query.isRefetchError ? query.error : undefined,
  };
}
