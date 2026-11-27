import {
  type DefaultError,
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
  /** The read failed under data it still shows. */
  readonly refresh?: true;
}

/** A read Dispatch refused for good: the reader may not see it, or it is gone. */
export interface RefusedFault {
  /** It is being read again, though no Retry of the reader's asked. */
  readonly retrying: boolean;
  readonly retry?: undefined;
  readonly refusal: Refusal;
  /** The read failed under data it still shows. */
  readonly refresh?: true;
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

/**
 * Reads `options` as upstream gives them, under their key, so upstream's event refresh and its
 * widgets share the cache entry.
 */
export function useRead<TQueryFnData, TError, TQueryKey extends QueryKey, T = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, TError, TQueryFnData, TQueryKey>,
  { select }: ReadOptions<TQueryFnData, T> = {}
): Read<T, TError> {
  const query = useQuery<TQueryFnData, TError, T, TQueryKey>({ ...options, select });
  // A read again drops the error, so the failure this view saw is kept, with its query's time.
  const [seen, setSeen] = useState<{ readonly error: TError; readonly at: number } | null>(null);
  if (!query.isPending && query.error !== null && query.errorUpdatedAt !== seen?.at) {
    setSeen({ error: query.error, at: query.errorUpdatedAt });
  }
  const own = seen?.at === query.errorUpdatedAt ? seen.error : null;
  // A view that mounts on a failed read, or moves to one, saw no failure of it yet.
  if (query.isPending && own === null) return { state: "loading" };
  const retrying = query.fetchStatus !== "idle";
  if (query.isPending || query.isLoadingError) {
    const error = query.isPending ? own : query.error;
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
