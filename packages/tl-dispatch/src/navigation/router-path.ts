import { matchRoutes } from "react-router-dom";

import { pathSegments } from "./path";

/** A path of navigation's grammar in the router's: React Router reads `:name` and a last `*`. */
export function routerPath(path: string): string {
  const segments = pathSegments(path).map((segment) => {
    if (segment.kind === "text") return segment.text;
    return segment.kind === "param" ? `:${segment.name}` : "*";
  });
  return `/${segments.join("/")}`;
}

/** Among paths in the router's grammar, the index of the one the router ranks first for a pathname. */
export function firstMatch(paths: readonly string[], pathname: string): number | undefined {
  const routes = paths.map((path, index) => ({ path, id: String(index) }));
  const leaf = matchRoutes(routes, pathname)?.at(-1);
  return leaf === undefined ? undefined : Number(leaf.route.id);
}
