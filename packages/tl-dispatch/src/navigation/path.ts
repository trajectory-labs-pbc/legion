/**
 * Navigation's path grammar, the one every page declares its paths in: `/`-separated text, a
 * `:name` segment for a param, and a last `*` for the rest of the address. This module alone
 * reads it; `routerPath` in `route-tree.tsx` writes it in the router's grammar.
 */

type Segments<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? Head | Segments<Tail>
  : Path;

/** The names a path's `:name` segments bind: `"/issues/:key/*"` binds `"key"`. */
export type PathParamName<Path extends string> =
  Segments<Path> extends infer Segment ? (Segment extends `:${infer Name}` ? Name : never) : never;

/** A path's params: each `:name`, and the rest of the address under a last `*`. */
export type PathParams<Path extends string> = {
  readonly [Name in PathParamName<Path>]: string;
} & (Path extends `${string}*` ? { readonly "*"?: string } : unknown);

/** Params a caller passes: optional where the path binds no `:name`. */
export type ParamsArg<Path extends string> = [PathParamName<Path>] extends [never]
  ? [params?: PathParams<Path>]
  : [params: PathParams<Path>];

/** `params` as a prop: required only where the path binds a `:name`. */
export type ParamsProp<Path extends string> = { params?: PathParams<Path> } & ([
  PathParamName<Path>,
] extends [never]
  ? unknown
  : { params: PathParams<Path> });

export type PathSegment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "param"; readonly name: string }
  | { readonly kind: "rest" };

const PARAM_NAME = /^[A-Za-z_]\w*$/;

/**
 * A path's segments after the leading `/`. A `*` anywhere but last, a param with no name or a
 * name that is not a word (`:id?`, `:name.:ext`), and a name bound twice all throw.
 */
export function pathSegments(path: string): readonly PathSegment[] {
  if (!path.startsWith("/")) throw new Error(`the path "${path}" does not start with /`);
  const parts = path.slice(1).split("/");
  const names = new Set<string>();
  return parts.map((part, index): PathSegment => {
    if (part === "*") {
      if (index !== parts.length - 1) throw new Error(`"${path}": * comes last`);
      return { kind: "rest" };
    }
    if (!part.startsWith(":")) return { kind: "text", text: part };
    const name = part.slice(1);
    if (name === "") throw new Error(`"${path}": a param needs a name`);
    if (!PARAM_NAME.test(name)) throw new Error(`"${path}": "${part}" is not a param name`);
    if (names.has(name)) throw new Error(`"${path}" binds "${name}" twice`);
    names.add(name);
    return { kind: "param", name };
  });
}

const encodeRest = (rest: string) => rest.split("/").map(encodeURIComponent).join("/");

/** The address of a path with these params, each encoded. A missing param throws. */
export function fillPath(
  path: string,
  params: Readonly<Record<string, string | undefined>>
): string {
  const filled = pathSegments(path).map((segment) => {
    if (segment.kind === "text") return segment.text;
    if (segment.kind === "rest") return encodeRest(params["*"] ?? "");
    const value = params[segment.name];
    if (value === undefined || value === "") {
      throw new Error(`${path} needs its "${segment.name}" param`);
    }
    return encodeURIComponent(value);
  });
  return `/${filled.join("/")}`.replace(/(.)\/+$/, "$1");
}

/** Whether `value` holds a string for each `:name` of the path: a router's match does. */
export function isParamsOf<Path extends string>(
  path: Path,
  value: Readonly<Record<string, string | undefined>>
): value is Readonly<Record<string, string | undefined>> & PathParams<Path> {
  return pathSegments(path).every(
    (segment) => segment.kind !== "param" || typeof value[segment.name] === "string"
  );
}

/** Whether the address is the path's or below it: Priorities stays lit on one priority's page. */
export function pathUnder(path: string, pathname: string): boolean {
  const own = pathSegments(path);
  const at = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (own.length === 1 && own[0]?.kind === "text" && own[0].text === "") return pathname === "/";
  return own.every((segment, index) => {
    if (segment.kind === "rest") return true;
    const part = at[index];
    if (part === undefined || part === "") return false;
    return segment.kind === "param" || segment.text.toLowerCase() === part.toLowerCase();
  });
}
