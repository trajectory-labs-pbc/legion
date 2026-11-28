import {
  type FetchQueryOptions,
  type QueryClient,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";

/** The client a prefetch starts its read on. */
export type PrefetchClient = Pick<QueryClient, "prefetchQuery">;

/** A read a route needs, which a link may start before the page opens. */
export function prefetchOf<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): { start(client: PrefetchClient): Promise<void> } {
  return { start: (client) => client.prefetchQuery(options) };
}

/** The app's client, on which a link starts its page's prefetches. */
export function usePrefetchClient(): PrefetchClient {
  return useQueryClient();
}
