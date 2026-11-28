import type { FetchQueryOptions, QueryClient, QueryKey } from "@tanstack/react-query";

/** A read a route needs, which a link may start before the page opens. */
export function prefetchOf<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): { start(client: QueryClient): Promise<void> } {
  return { start: (client) => client.prefetchQuery(options) };
}
