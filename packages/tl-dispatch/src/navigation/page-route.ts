import type { FetchQueryOptions, QueryClient, QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

type Segments<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? Head | Segments<Tail>
  : Path;

/** The names a path's `:name` segments bind: `"/issues/:key/*"` binds `"key"`. */
export type PathParamName<Path extends string> =
  Segments<Path> extends infer Segment ? (Segment extends `:${infer Name}` ? Name : never) : never;

/** A path's params: each `:name`, and the rest of the address under a trailing `*`. */
export type PathParams<Path extends string> = {
  readonly [Name in PathParamName<Path>]: string;
} & (Path extends `${string}*` ? { readonly "*"?: string } : unknown);

/** The search keys a page reads, each optional. */
export type PageSearch<Search extends string> = { readonly [Key in Search]?: string };

/** A read a page makes first, which a link may start before the page opens. */
export interface Prefetch {
  queryKey: QueryKey;
  start(client: QueryClient): Promise<void>;
}

export function prefetchOf<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): Prefetch {
  return { queryKey: options.queryKey, start: (client) => client.prefetchQuery(options) };
}

/** One address of a page: its path, what it draws, its search keys and its first reads. */
export interface PageRoute<Path extends string = string, Search extends string = string> {
  readonly path: Path;
  readonly element: ReactNode;
  readonly search?: readonly Search[];
  prefetch?(params: PathParams<Path>): readonly Prefetch[];
}

/** Keeps the path and the search keys as literals, so links to the route are typed. */
export function pageRoute<const Path extends string, const Search extends string = never>(
  route: PageRoute<Path, Search>
): PageRoute<Path, Search> {
  return route;
}

const encodeRest = (rest: string) => rest.split("/").map(encodeURIComponent).join("/");

/** The address of a route with these params and search. A missing param throws. */
export function pageHref<Path extends string, Search extends string>(
  page: PageRoute<Path, Search>,
  params: PathParams<Path>,
  search?: PageSearch<Search>
): string {
  const values: Readonly<Record<string, string | undefined>> = params;
  const path = page.path
    .split("/")
    .map((segment) => {
      if (segment === "*") return encodeRest(values["*"] ?? "");
      if (!segment.startsWith(":")) return segment;
      const value = values[segment.slice(1)];
      if (value === undefined || value === "") {
        throw new Error(`${page.path} needs its "${segment.slice(1)}" param`);
      }
      return encodeURIComponent(value);
    })
    .join("/")
    .replace(/(.)\/+$/, "$1");
  const query = new URLSearchParams();
  const given: Readonly<Record<string, string | undefined>> = search ?? {};
  for (const key of page.search ?? []) {
    const value = given[key];
    if (value !== undefined) query.set(key, value);
  }
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}
