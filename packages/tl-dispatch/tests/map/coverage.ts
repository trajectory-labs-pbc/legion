import { join, relative } from "node:path";

import { pages } from "@/pages/index";
import type { Page } from "@/pages/page";
import { replacedViews, sharedViews, shellViews, widgetViews } from "@/views";
import { type Files, filesWith, importsOf, resolutionCache } from "../imports";
import { PACKAGE_ROOT, sourceFiles, UPSTREAM_WEB } from "../source";
import { forkSrc, pageFile, upstreamScripts } from "./source";

export interface Owner {
  name: string;
  globs: readonly string[];
  /** Where the list is written, for a message that says what to update. */
  list: string;
  /** Set for a page: which app's code draws it. */
  server?: Page["server"];
}

export interface Coverage {
  /** Files nothing with an owner loads. */
  unmapped: string[];
  shared: { file: string; owners: string[] }[];
  /** Entries that match no view file: a file or folder upstream renamed or removed. */
  unused: { owner: string; glob: string; list: string }[];
  /** A page's views that another page or the shell renders: they move to that owner or a shared list. */
  crossed: { file: string; owner: string; importers: string[] }[];
  /** Globs of a page this app serves, which names files so a new upstream view is reported. */
  globbed: { owner: string; glob: string; list: string }[];
  /** Files no list names that hang only from a page this app serves: upstream added to that page. */
  added: { file: string; owner: string; list: string }[];
  /** The pages this app serves, whose findings fail; the others' are notes. */
  forkPages: string[];
}

/** Each page, the shell, each widget and each shared list, with the view files it owns. */
export function owners(): Owner[] {
  return [
    // By id, as the page files sort: the first owner of a file decides where it is shared.
    ...[...pages]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((page) => ({
        name: `page:${page.id}`,
        globs: page.views,
        list: `src/pages/${page.id}.tsx views`,
        server: page.server,
      })),
    { name: "shell", globs: shellViews, list: "src/views.ts shellViews" },
    ...Object.entries(widgetViews).map(([name, globs]) => ({
      name: `widget:${name}`,
      globs,
      list: `src/views.ts widgetViews.${name}`,
    })),
    ...Object.entries(sharedViews).map(([name, globs]) => ({
      name: `shared:${name}`,
      globs,
      list: `src/views.ts sharedViews.${name}`,
    })),
  ];
}

const isExact = (glob: string) => !/[*?[{]/.test(glob);

interface Matcher {
  owner: string;
  glob: string;
  list: string;
  matcher: Bun.Glob;
}

const matchersOf = (all: readonly Owner[]): Matcher[] =>
  all.flatMap((owner) =>
    owner.globs.map((glob) => ({
      owner: owner.name,
      glob,
      list: owner.list,
      matcher: new Bun.Glob(glob),
    }))
  );

/** The owners of a file: those naming it exactly, else those whose glob matches it. */
function ownersOf(
  file: string,
  matchers: readonly Matcher[]
): { owners: string[]; hits: Matcher[] } {
  const hits = matchers.filter((entry) => entry.matcher.match(file));
  const exact = hits.filter((entry) => isExact(entry.glob));
  const deciding = exact.length > 0 ? exact : hits;
  return { owners: [...new Set(deciding.map((entry) => entry.owner))], hits };
}

/** The owner of a file of this app: its page, for a page file and the folder of its name, else the shell. */
export function ownOwner(file: string, pageFiles: readonly { file: string; id: string }[]): string {
  const page = pageFiles.find(
    (entry) => file === entry.file || file.startsWith(`${entry.file.replace(/\.tsx?$/, "")}/`)
  );
  return page ? `page:${page.id}` : "shell";
}

/**
 * The files `file` loads at run time, type-only imports aside. An import that resolves to no file
 * and no package throws, so the map never drops an edge the build follows.
 */
export function loadedFiles(
  file: string,
  files: Files = filesWith(),
  cache = resolutionCache()
): string[] {
  return importsOf(file, files, cache).flatMap((entry) => {
    if (entry.kind === "type") return [];
    if (!entry.resolved) {
      throw new Error(
        `${file}:${entry.line}: ${entry.specifier ?? "an import"} resolves to no file and no package, so the view map cannot follow it`
      );
    }
    return entry.file === undefined ? [] : [entry.file];
  });
}

/**
 * For each script under upstream's `features/`, what loads it at run time: an upstream file by its
 * path under `web/src`, a file of this app by its owner.
 */
export function importGraph(): Map<string, string[]> {
  const files = filesWith();
  const cache = resolutionCache();
  const own = pages.map((page) => ({ file: pageFile(page.id), id: page.id }));
  const scripts = [
    ...upstreamScripts(join(UPSTREAM_WEB, "features")),
    ...sourceFiles()
      .filter((file) => /\.tsx?$/.test(file.path))
      .map((file) => join(PACKAGE_ROOT, file.path)),
  ];
  const graph = new Map<string, string[]>();
  for (const file of scripts) {
    const ref = file.startsWith(forkSrc) ? ownOwner(file, own) : relative(UPSTREAM_WEB, file);
    for (const target of loadedFiles(file, files, cache)) {
      const loaded = relative(UPSTREAM_WEB, target);
      if (loaded.startsWith("features/")) graph.set(loaded, [...(graph.get(loaded) ?? []), ref]);
    }
  }
  return graph;
}

const isOwnerName = (ref: string) => ref === "shell" || ref.includes(":");
const spreads = (owner: string) => owner.startsWith("shared:") || owner.startsWith("widget:");

/**
 * Each file's owner once the import graph is applied. A file no list names takes the owner of what
 * loads it, or is shared when two owners do. A page's view that only its own page and shared or
 * widget files load is shared too, so a shared list names only the files two owners load directly.
 * A module that is not a view, such as a hook, is followed to what loads it.
 */
export function effectiveOwners(
  files: readonly string[],
  all: readonly Owner[],
  graph: ReadonlyMap<string, readonly string[]>
): {
  owner: Map<string, string>;
  loaders: (file: string) => string[];
  inferred: Set<string>;
  roots: (file: string) => string[];
  matchers: Matcher[];
  /** Each file's owners by the lists alone, and the entries that match it. */
  matched: Map<string, { owners: string[]; hits: Matcher[] }>;
} {
  const matchers = matchersOf(all);
  const matched = new Map(files.map((file) => [file, ownersOf(file, matchers)]));
  const owner = new Map<string, string>();
  const unlisted: string[] = [];
  for (const [file, { owners: found }] of matched) {
    if (found.length === 1 && found[0]) owner.set(file, found[0]);
    if (found.length === 0) unlisted.push(file);
  }
  const listed = new Map(owner);
  const views = new Set(files);
  /** A script under `features/` that is not a view and that something loads. */
  const isModule = (ref: string) => !isOwnerName(ref) && !views.has(ref) && graph.has(ref);
  /**
   * The listed owners a file no list names hangs from: those of what loads it, followed through
   * other unlisted files. A page's view that became shared still counts as its page's here.
   */
  const roots = (file: string, seen = new Set<string>()): string[] => {
    if (seen.has(file)) return [];
    seen.add(file);
    const found = (graph.get(file) ?? []).flatMap((ref) => {
      if (isOwnerName(ref)) return [ref];
      if (isModule(ref)) return roots(ref, seen);
      const name = listed.get(ref) ?? ownersOf(ref, matchers).owners[0];
      return name === undefined ? roots(ref, seen) : [name];
    });
    return [...new Set(found)];
  };
  const inferred = new Set<string>();
  const ownerOfRef = (ref: string): string =>
    isOwnerName(ref) ? ref : (owner.get(ref) ?? ownersOf(ref, matchers).owners[0] ?? "unmapped");
  const loaders = (file: string, seen = new Set([file])): string[] =>
    [
      ...new Set(
        (graph.get(file) ?? []).flatMap((ref) => {
          if (!isModule(ref)) return [ownerOfRef(ref)];
          if (seen.has(ref)) return [];
          seen.add(ref);
          return loaders(ref, seen);
        })
      ),
    ].sort();
  for (let changed = true; changed; ) {
    changed = false;
    for (const file of unlisted) {
      const known = loaders(file).filter((name) => name !== "unmapped");
      const name = known.length === 1 ? known[0] : known.length > 1 ? "shared:inferred" : undefined;
      if (name !== undefined && owner.get(file) !== name) {
        owner.set(file, name);
        inferred.add(file);
        changed = true;
      }
    }
    for (const [file, name] of owner) {
      if (!name.startsWith("page:")) continue;
      const others = loaders(file).filter((other) => other !== name);
      if (others.length > 0 && others.every(spreads)) {
        owner.set(file, "shared:inferred");
        changed = true;
      }
    }
  }
  return { owner, loaders, inferred, roots, matchers, matched };
}

export function coverage(
  files: readonly string[],
  all: readonly Owner[],
  graph: ReadonlyMap<string, readonly string[]> = new Map()
): Coverage {
  const used = new Set<string>();
  const served = all.filter((entry) => entry.server === "fork");
  const forkPages = served.map((entry) => entry.name);
  const result: Coverage = {
    unmapped: [],
    shared: [],
    unused: [],
    crossed: [],
    globbed: [],
    added: [],
    forkPages,
  };
  const { owner, loaders, inferred, roots, matchers, matched } = effectiveOwners(files, all, graph);
  for (const [file, { owners: names, hits }] of matched) {
    for (const hit of hits) used.add(`${hit.owner}\0${hit.glob}`);
    const name = owner.get(file);
    if (names.length === 0 && name === undefined) result.unmapped.push(file);
    if (names.length > 1) result.shared.push({ file, owners: names });
    const [root, ...more] = inferred.has(file) ? roots(file) : [];
    if (root !== undefined && more.length === 0 && forkPages.includes(root)) {
      const list = all.find((entry) => entry.name === root)?.list ?? root;
      result.added.push({ file, owner: root, list });
    }
    if (name?.startsWith("page:")) {
      const others = loaders(file).filter((other) => other !== name && other !== "unmapped");
      if (others.length > 0) result.crossed.push({ file, owner: name, importers: others });
    }
  }
  result.unused = matchers
    .filter((entry) => !used.has(`${entry.owner}\0${entry.glob}`))
    .map(({ owner: name, glob, list }) => ({ owner: name, glob, list }));
  result.globbed = served.flatMap((entry) =>
    entry.globs
      .filter((glob) => !isExact(glob))
      .map((glob) => ({ owner: entry.name, glob, list: entry.list }))
  );
  return result;
}

const unusedLine = ({ glob, list }: Coverage["unused"][number]) =>
  `${list} names ${glob}, which matches no upstream view: upstream renamed or removed it; name the file that replaced it, or drop the entry`;
const crossedLine = ({ file, owner: name, importers }: Coverage["crossed"][number]) =>
  `${file} is ${name}'s, and ${importers.join(", ")} also load it: name it in src/views.ts sharedViews.pages, or in the list of the one owner that loads it`;

/**
 * The problems that fail, each saying what to update: those of a page this app serves, whose
 * upstream files it replaced, and a file two lists name.
 */
export function messages(result: Coverage): string[] {
  const fork = (owner: string) => result.forkPages.includes(owner);
  return [
    ...result.added.map(
      ({ file, owner, list }) =>
        `${file} is new upstream, and only ${owner}'s files load it, which this app serves: port what it adds, then name it in ${list}`
    ),
    ...result.shared.map(
      ({ file, owners: names }) =>
        `${file} has more than one owner (${names.join(", ")}): keep it in one list`
    ),
    ...result.unused.filter((entry) => fork(entry.owner)).map(unusedLine),
    ...result.crossed.filter((entry) => fork(entry.owner)).map(crossedLine),
    ...result.globbed.map(
      ({ glob, list }) =>
        `${list} has the glob ${glob}: a page this app serves names each upstream file it replaces`
    ),
  ];
}

/**
 * What upstream churn changed on pages upstream draws: nothing to port, since those pages render
 * upstream's own files, but the map entries to tidy.
 */
export function notes(result: Coverage): string[] {
  const upstream = (owner: string) => !result.forkPages.includes(owner);
  return [
    ...result.unmapped.map(
      (file) =>
        `${file} has no owner and nothing with one loads it: name it in a list if a page uses it`
    ),
    ...result.unused.filter((entry) => upstream(entry.owner)).map(unusedLine),
    ...result.crossed.filter((entry) => upstream(entry.owner)).map(crossedLine),
  ];
}

/**
 * Each key of `replaced` that is not a view file under upstream's `features/`. The copies gate
 * holds its value to the file's pin, and the pin's copy to a file of this app.
 */
export function replacedViewProblems(
  files: readonly string[],
  replaced: Readonly<Record<string, string>> = replacedViews
): string[] {
  const views = new Set(files);
  return Object.keys(replaced)
    .filter((view) => !views.has(view))
    .map(
      (view) =>
        `src/views.ts replacedViews names ${view}, which is not a view file under upstream's features/: name the file the fork replaced`
    );
}
