import { join, sep } from "node:path";

import {
  type Files,
  filesWith,
  type Import,
  importsOf,
  ownFiles,
  ownOrUpstream,
  packageRelative,
  reach,
  resolutionCache,
} from "./imports";
import {
  type BREAKS,
  type Layer,
  LIBRARIES,
  ONE_ROW,
  READERS,
  ROOT_FILES,
  ROWS,
  RULES,
  type Rule,
  UPSTREAM_DOORS,
} from "./layers.table";
import { PACKAGE_ROOT, REPO_ROOT, type SourceFile, TEST, UPSTREAM_WEB } from "./source";

export interface LayerViolation {
  file: string;
  line: number;
  specifier: string;
  rule: Rule;
  detail: string;
}

/** Upstream's app opens a second sign-in channel when it loads; its entry loads the app. */
const NEVER_LOADED = new Map([
  [join(UPSTREAM_WEB, "app.tsx"), "app.tsx"],
  [join(UPSTREAM_WEB, "main.tsx"), "main.tsx"],
]);
const RUNTIME = new Set(["static", "dynamic", "require"]);
const UI_PACKAGE = join(REPO_ROOT, "packages/ui");
const INDEX = /^index\.[jt]sx?$/;

const patterns = new Map<string, RegExp>();

/**
 * A table path as a pattern: a folder matches what is under it, a file matches itself, `*`
 * matches one path segment and `<name>` matches one and captures it.
 */
function pattern(path: string): RegExp {
  let regex = patterns.get(path);
  if (regex === undefined) {
    const body = path
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]+")
      .replace(/<(\w+)>/g, "(?<$1>[^/]+)");
    regex = new RegExp(/\.[a-z]+$/.test(path) ? `^${body}$` : `^${body}/`);
    patterns.set(path, regex);
  }
  return regex;
}

/** A table keyed by paths: the entry whose path matches most specifically, and what it captured. */
function lookup<T>(entries: readonly (readonly [string, T])[]) {
  const longestFirst = [...entries].sort(([a], [b]) => b.length - a.length);
  return (path: string) => {
    for (const [key, value] of longestFirst) {
      const match = pattern(key).exec(path);
      if (match !== null) return { value, captured: match.groups ?? {} };
    }
    return undefined;
  };
}

const layerAt = lookup(
  ROWS.flatMap((row, rank) =>
    row.flatMap(({ layer, paths }) =>
      paths.map((path) => [path, { layer: layer as Layer, rank }] as const)
    )
  )
);
const readersAt = lookup(Object.entries(READERS));
const isRootFile = (path: string) => ROOT_FILES.some((root) => pattern(root).test(path));
/** The layers whose entries are folders `src/<layer>/<name>/`, each with its index.ts. */
const FOLDER_LAYERS = new Set<string>(
  ROWS.flat()
    .filter(({ paths }) => paths.some((path: string) => path.endsWith("/*")))
    .map(({ layer }) => layer)
);

/** The layer of a file of the app by its path from the package root, as the table gives it. */
export const layerOf = (path: string): Layer | undefined => layerAt(path)?.value.layer;

/** A file of the package as the rules see it. */
interface Place {
  path: string;
  /** `tests`: a file under tests/, or a test directly under src/ whose file has no layer. */
  layer: Layer | "tests" | undefined;
  rank: number;
  test: boolean;
  /** The `src/<layer>/<name>` folder of a file in a folder layer. */
  folder: string | undefined;
}

function placeOf(path: string): Place {
  if (path.startsWith("tests/")) {
    return { path, layer: "tests", rank: 0, test: true, folder: undefined };
  }
  const test = TEST.test(path);
  // A test is in the layer of the file it tests.
  const found = layerAt(test ? path.replace(/\.test(?=\.[cm]?[jt]sx?$)/, "") : path)?.value;
  const rootTest = test && path.split("/").length === 2;
  const layer = found?.layer ?? (rootTest ? "tests" : undefined);
  const folder =
    found !== undefined && FOLDER_LAYERS.has(found.layer)
      ? path.split("/").slice(0, 3).join("/")
      : undefined;
  return { path, layer, rank: found?.rank ?? 0, test, folder };
}

function readable(entry: Import): string | undefined {
  if (entry.glob === true) {
    return "import.meta.glob names files by pattern, so no rule can read them; import each";
  }
  if (entry.specifier === undefined) {
    return "a non-literal import() or require() names no module a rule can read; write the path";
  }
  return entry.resolved ? undefined : "the specifier resolves to no file and no package";
}

function libraryRules(from: Place, pkg: string): [Rule, string][] {
  return LIBRARIES.filter(
    (library) =>
      library.name.test(pkg) &&
      !(from.layer !== undefined && library.owners.includes(from.layer as Layer)) &&
      !(from.test && library.tests)
  ).map((library) => ["library-owners", library.reason]);
}

/** A seam file and a root file are read only by the readers that the table gives them. */
function readerRules(from: Place, to: Place): [Rule, string][] {
  const seam = to.layer === "upstream";
  if (!(isRootFile(to.path) || (seam && from.layer !== "upstream")) || (seam && from.test)) {
    return [];
  }
  const found = readersAt(to.path);
  const readers = found?.value ?? [];
  const reads = readers.some(
    (reader) =>
      reader === from.layer ||
      pattern(reader.replace(/<(\w+)>/g, (name, key: string) => found?.captured[key] ?? name)).test(
        from.path
      )
  );
  return reads
    ? []
    : [["seam-readers", `${to.path} is read by ${readers.join(", ") || "no file"}`]];
}

function orderRules(from: Place, to: Place): [Rule, string][] {
  if (from.layer === undefined || from.layer === "tests" || to.layer === undefined) return [];
  if (to.layer === "tests") return [];
  if (to.rank > from.rank) return [["imports-only-above", `${from.layer} is above ${to.layer}`]];
  if (to.rank < from.rank || to.layer === from.layer) return [];
  const allowed = ONE_ROW[from.layer] ?? [];
  return allowed.some((path) => pattern(path).test(to.path))
    ? []
    : [["one-row", `${from.layer} does not import ${to.path}`]];
}

function folderRules(from: Place, to: Place): [Rule, string][] {
  if (to.folder === undefined || from.layer === "tests") return [];
  const rootIndex = INDEX.test(to.path.slice(to.folder.length + 1));
  if (!from.path.startsWith(`${to.folder}/`)) {
    return rootIndex ? [] : [["through-the-index", `${to.folder} is imported through its index`]];
  }
  return rootIndex ? [["no-own-index", `${to.folder} imports its own index`]] : [];
}

/** The rules one import breaks, each with what it names. */
function rulesFor(from: Place, entry: Import): [Rule, string][] {
  const broken: [Rule, string][] = [];
  const unreadable = readable(entry);
  if (unreadable !== undefined) broken.push(["imports-are-readable", unreadable]);
  if (entry.pkg !== undefined) broken.push(...libraryRules(from, entry.pkg));
  if (entry.file === undefined || entry.file.startsWith(UI_PACKAGE + sep)) return broken;

  if (!entry.file.startsWith(PACKAGE_ROOT + sep)) {
    if (from.layer !== "upstream" && !Object.hasOwn(UPSTREAM_DOORS, from.path)) {
      broken.push(["only-the-seam-imports-upstream", packageRelative(entry.file)]);
    }
    return broken;
  }
  const path = packageRelative(entry.file);
  if (!path.startsWith("src/")) {
    if (!from.test) broken.push(["imports-only-above", `only a test imports ${path}`]);
    return broken;
  }
  const to = placeOf(path);
  return [...broken, ...readerRules(from, to), ...orderRules(from, to), ...folderRules(from, to)];
}

/** Each set of folders whose imports make a chain back to its start: Tarjan's components. */
function cycles(edges: ReadonlyMap<string, ReadonlyMap<string, Import>>): string[][] {
  const order = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];
  const visit = (node: string) => {
    order.set(node, order.size);
    low.set(node, order.get(node) as number);
    stack.push(node);
    for (const next of edges.get(node)?.keys() ?? []) {
      if (!order.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node) as number, low.get(next) as number));
      } else if (stack.includes(next)) {
        low.set(node, Math.min(low.get(node) as number, order.get(next) as number));
      }
    }
    if (low.get(node) !== order.get(node)) return;
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop() as string;
      component.push(member);
    } while (member !== node);
    if (component.length > 1) found.push(component.sort());
  };
  for (const node of [...edges.keys()].sort()) if (!order.has(node)) visit(node);
  return found;
}

/**
 * Every layer rule `files` and the modules they reach break. Imports are resolved as the build
 * resolves them, and followed through upstream's code, so a chain that reaches upstream's app or
 * entry is refused at the file it starts from.
 */
export function layerViolations(files: readonly SourceFile[]): LayerViolation[] {
  const disk = filesWith(ownFiles(files));
  const cache = resolutionCache();
  const violations: LayerViolation[] = [];
  const at = (path: string, entry: Pick<Import, "line" | "specifier"> | undefined) => ({
    file: path,
    line: entry?.line ?? 1,
    specifier: entry === undefined ? "(the file)" : (entry.specifier ?? "(not a literal)"),
  });
  const edges = new Map<string, Map<string, Import>>();

  for (const file of files) {
    const from = placeOf(file.path);
    if (file.path.startsWith("src/") && from.layer === undefined && !isRootFile(file.path)) {
      violations.push({
        ...at(file.path, undefined),
        rule: "every-file-has-a-layer",
        detail: "no row of the table names it",
      });
    }
    const inner = from.folder === undefined ? "" : file.path.slice(from.folder.length + 1);
    if (inner.includes("/") && INDEX.test(inner.slice(inner.lastIndexOf("/") + 1))) {
      violations.push({
        ...at(file.path, undefined),
        rule: "index-only-at-the-root",
        detail: `${from.folder} has its index at its root`,
      });
    }
    for (const entry of importsOf(join(PACKAGE_ROOT, file.path), disk, cache)) {
      for (const [rule, detail] of rulesFor(from, entry)) {
        violations.push({ ...at(file.path, entry), rule, detail });
      }
      const to = entry.file === undefined ? undefined : placeOf(packageRelative(entry.file));
      if (from.folder !== undefined && to?.folder !== undefined && to.folder !== from.folder) {
        const out = edges.get(from.folder) ?? new Map<string, Import>();
        if (!out.has(to.folder)) out.set(to.folder, entry);
        edges.set(from.folder, out);
      }
    }
  }
  for (const component of cycles(edges)) {
    // The import from the component's first folder to another of its folders.
    const out = edges.get(component[0] as string);
    const entry = component.map((folder) => out?.get(folder)).find((found) => found !== undefined);
    if (entry === undefined) continue;
    violations.push({
      ...at(packageRelative(entry.from), entry),
      rule: "no-cycles",
      detail: component.join(", "),
    });
  }
  violations.push(...upstreamAppLoads(files, disk));
  return violations;
}

/** The files of `files` whose imports, followed through upstream's code, reach its app or entry. */
export function upstreamAppLoads(
  files: readonly SourceFile[],
  disk: Files = filesWith(ownFiles(files))
): LayerViolation[] {
  const { reachedBy } = reach(
    files.map((file) => join(PACKAGE_ROOT, file.path)),
    (entry) => entry.file !== undefined && RUNTIME.has(entry.kind) && ownOrUpstream(entry.file),
    { files: disk }
  );
  const found: LayerViolation[] = [];
  for (const [target, name] of NEVER_LOADED) {
    const chain: Import[] = [];
    for (
      let entry = reachedBy.get(target);
      entry !== undefined;
      entry = reachedBy.get(entry.from)
    ) {
      chain.unshift(entry);
    }
    const first = chain[0];
    if (first === undefined) continue;
    const path = [first.from, ...chain.map((entry) => entry.file as string)]
      .map(packageRelative)
      .join(" > ");
    found.push({
      file: packageRelative(first.from),
      line: first.line,
      specifier: first.specifier ?? "(not a literal)",
      rule: "upstream-app-never-loads",
      detail: `reaches upstream's ${name}, which opens a second sign-in channel: ${path}`,
    });
  }
  return found;
}

/** The violations that `breaks` does not list, and the entries of `breaks` that break no rule. */
export function againstBreaks(
  violations: readonly LayerViolation[],
  breaks: typeof BREAKS
): { unlisted: LayerViolation[]; stale: string[] } {
  const key = (rule: string, file: string, specifier: string) => `${rule} ${file} ${specifier}`;
  const left = new Map<string, number>();
  for (const [rule, byFile] of Object.entries(breaks)) {
    for (const [file, specifiers] of Object.entries(byFile ?? {})) {
      for (const specifier of specifiers) {
        const entry = key(rule, file, specifier);
        left.set(entry, (left.get(entry) ?? 0) + 1);
      }
    }
  }
  const unlisted = violations.filter((violation) => {
    const entry = key(violation.rule, violation.file, violation.specifier);
    const count = left.get(entry) ?? 0;
    left.set(entry, count - 1);
    return count <= 0;
  });
  return {
    unlisted,
    stale: [...left].flatMap(([entry, count]) => Array<string>(Math.max(count, 0)).fill(entry)),
  };
}

/** The rules of the table that no `##` heading of `markdown` names in a code span. */
export function rulesWithoutHeading(markdown: string): Rule[] {
  const headings = markdown.split("\n").filter((line) => line.startsWith("## "));
  return RULES.filter((rule) => !headings.some((heading) => heading.includes(`\`${rule}\``)));
}
