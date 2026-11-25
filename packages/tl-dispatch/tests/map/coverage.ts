import { basename, relative } from "node:path";

import { sharedViews, shellViews, widgetViews } from "@/views";
import { UPSTREAM_WEB } from "../source";
import { featureViews, forkSrc, readPages, viewImporters } from "./source";

export interface Owner {
  name: string;
  globs: readonly string[];
  /** Where the list is written, for a message that says what to update. */
  list: string;
  /** Set for a page: which app's code draws it. */
  server?: "upstream" | "fork";
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
  /** Files no list names that only a page this app serves loads: upstream added to that page. */
  added: { file: string; owner: string; list: string }[];
  /** The pages this app serves, whose findings fail; the others' are notes. */
  forkPages: string[];
}

/** Each page, the shell, each widget and each shared list, with the view files it owns. */
export function owners(): Owner[] {
  return [
    ...readPages().map((page) => ({
      name: `page:${page.id}`,
      globs: page.views,
      list: `src/pages/${basename(page.file)} views`,
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

/**
 * For each view file, what loads it at run time: an upstream file by its path under `web/src`, a
 * file of this app by its owner (its page, else the shell).
 */
export function importGraph(): Map<string, string[]> {
  const pageOf = new Map(readPages().map((page) => [page.file, `page:${page.id}`]));
  const graph = new Map<string, string[]>();
  for (const [view, files] of viewImporters()) {
    graph.set(
      view,
      files.map((file) =>
        file.startsWith(forkSrc) ? (pageOf.get(file) ?? "shell") : relative(UPSTREAM_WEB, file)
      )
    );
  }
  return graph;
}

const isOwnerName = (ref: string) => ref === "shell" || ref.includes(":");
const spreads = (owner: string) => owner.startsWith("shared:") || owner.startsWith("widget:");

/**
 * Each file's owner once the import graph is applied. A file no list names takes the owner of what
 * loads it, or is shared when two owners do. A page's view that only its own page and shared or
 * widget files load is shared too, so a shared list names only the files two owners load directly.
 */
export function effectiveOwners(
  files: readonly string[],
  all: readonly Owner[],
  graph: ReadonlyMap<string, readonly string[]>
): { owner: Map<string, string>; loaders: (file: string) => string[]; inferred: Set<string> } {
  const matchers = matchersOf(all);
  const owner = new Map<string, string>();
  const unlisted: string[] = [];
  for (const file of files) {
    const found = ownersOf(file, matchers).owners;
    if (found.length === 1 && found[0]) owner.set(file, found[0]);
    if (found.length === 0) unlisted.push(file);
  }
  const inferred = new Set<string>();
  const ownerOfRef = (ref: string): string =>
    isOwnerName(ref) ? ref : (owner.get(ref) ?? ownersOf(ref, matchers).owners[0] ?? "unmapped");
  const loaders = (file: string): string[] =>
    [...new Set((graph.get(file) ?? []).map(ownerOfRef))].sort();
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
  return { owner, loaders, inferred };
}

export function coverage(
  files: readonly string[],
  all: readonly Owner[],
  graph: ReadonlyMap<string, readonly string[]> = new Map()
): Coverage {
  const matchers = matchersOf(all);
  const used = new Set<string>();
  const forkPages = all.filter((entry) => entry.server === "fork").map((entry) => entry.name);
  const result: Coverage = {
    unmapped: [],
    shared: [],
    unused: [],
    crossed: [],
    globbed: [],
    added: [],
    forkPages,
  };
  const { owner, loaders, inferred } = effectiveOwners(files, all, graph);
  for (const file of files) {
    const { owners: names, hits } = ownersOf(file, matchers);
    for (const hit of hits) used.add(`${hit.owner}\0${hit.glob}`);
    const name = owner.get(file);
    if (names.length === 0 && name === undefined) result.unmapped.push(file);
    if (names.length > 1) result.shared.push({ file, owners: names });
    if (name && inferred.has(file) && forkPages.includes(name)) {
      const list = all.find((entry) => entry.name === name)?.list ?? name;
      result.added.push({ file, owner: name, list });
    }
    if (name?.startsWith("page:")) {
      const others = loaders(file).filter((other) => other !== name);
      if (others.length > 0) result.crossed.push({ file, owner: name, importers: others });
    }
  }
  result.unused = matchers
    .filter((entry) => !used.has(`${entry.owner}\0${entry.glob}`))
    .map(({ owner: name, glob, list }) => ({ owner: name, glob, list }));
  result.globbed = all
    .filter((entry) => entry.server === "fork")
    .flatMap((entry) =>
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
        `${file} is new upstream, and only ${owner} loads it, which this app serves: port what it adds, then name it in ${list}`
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

/** The view map for the current trees. */
export function viewMap(): Coverage {
  return coverage(featureViews(), owners(), importGraph());
}
