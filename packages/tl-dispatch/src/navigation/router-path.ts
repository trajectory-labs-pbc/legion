import { pathSegments } from "./path";

/** A path of navigation's grammar in the router's: React Router reads `:name` and a last `*`. */
export function routerPath(path: string): string {
  const segments = pathSegments(path).map((segment) => {
    if (segment.kind === "text") return segment.text;
    return segment.kind === "param" ? `:${segment.name}` : "*";
  });
  return `/${segments.join("/")}`;
}
