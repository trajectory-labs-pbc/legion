import { relative } from "node:path";

import { sharedViews, shellViews, widgetViews } from "../views";
import { featureViews, forkSrc, readPages, upstreamWebSrc, viewImporters } from "./source";

export interface Owner {
  name: string;
  globs: readonly string[];
}

export interface Coverage {
  unmapped: string[];
  shared: { file: string; owners: string[] }[];
  /** Entries that match no view file: a file or folder upstream renamed or removed. */
  unused: { owner: string; glob: string }[];
  /** A page's views that another owner renders: they belong to that owner, or to a shared list. */
  crossed: { file: string; owner: string; importers: string[] }[];
}

/** Each page, the shell, each widget and each shared list, with the view files it owns. */
export function owners(): Owner[] {
  return [
    ...readPages().map((page) => ({ name: `page:${page.id}`, globs: page.views })),
    { name: "shell", globs: shellViews },
    ...Object.entries(widgetViews).map(([name, globs]) => ({ name: `widget:${name}`, globs })),
    ...Object.entries(sharedViews).map(([name, globs]) => ({ name: `shared:${name}`, globs })),
  ];
}

const isExact = (glob: string) => !/[*?[{]/.test(glob);

/** The owners of a file: those naming it exactly, else those whose glob matches it. */
function ownersOf(
  file: string,
  matchers: readonly { owner: string; glob: string; matcher: Bun.Glob }[]
): { owners: string[]; hits: typeof matchers } {
  const hits = matchers.filter((entry) => entry.matcher.match(file));
  const exact = hits.filter((entry) => isExact(entry.glob));
  const deciding = exact.length > 0 ? exact : hits;
  return { owners: [...new Set(deciding.map((entry) => entry.owner))], hits };
}

/** The owner of each file that imports a view: this app's page files are their page, the rest its shell. */
export function importerOwners(): Map<string, string[]> {
  const pageOf = new Map(readPages().map((page) => [page.file, `page:${page.id}`]));
  const all = owners();
  const matchers = all.flatMap((owner) =>
    owner.globs.map((glob) => ({ owner: owner.name, glob, matcher: new Bun.Glob(glob) }))
  );
  const result = new Map<string, string[]>();
  for (const [view, files] of viewImporters()) {
    const names = files.map((file) => {
      if (file.startsWith(forkSrc)) return pageOf.get(file) ?? "shell";
      return ownersOf(relative(upstreamWebSrc, file), matchers).owners[0] ?? "unmapped";
    });
    result.set(view, [...new Set(names)].sort());
  }
  return result;
}

export function coverage(
  files: readonly string[],
  all: readonly Owner[],
  importers: ReadonlyMap<string, readonly string[]> = new Map()
): Coverage {
  const matchers = all.flatMap((owner) =>
    owner.globs.map((glob) => ({ owner: owner.name, glob, matcher: new Bun.Glob(glob) }))
  );
  const used = new Set<string>();
  const result: Coverage = { unmapped: [], shared: [], unused: [], crossed: [] };
  for (const file of files) {
    const { owners: names, hits } = ownersOf(file, matchers);
    for (const hit of hits) used.add(`${hit.owner}\0${hit.glob}`);
    if (names.length === 0) {
      result.unmapped.push(file);
      continue;
    }
    if (names.length > 1) {
      result.shared.push({ file, owners: names });
      continue;
    }
    const [owner] = names as [string];
    const others = (importers.get(file) ?? []).filter((name) => name !== owner);
    if (owner.startsWith("page:") && others.length > 0) {
      result.crossed.push({ file, owner, importers: others });
    }
  }
  result.unused = matchers
    .filter((entry) => !used.has(`${entry.owner}\0${entry.glob}`))
    .map(({ owner, glob }) => ({ owner, glob }));
  return result;
}

if (import.meta.main) {
  const files = featureViews();
  const result = coverage(files, owners(), importerOwners());
  for (const file of result.unmapped) console.error(`unmapped: ${file}`);
  for (const { file, owners: names } of result.shared) {
    console.error(`more than one owner: ${file} (${names.join(", ")})`);
  }
  for (const { owner, glob } of result.unused) console.error(`matches no file: ${owner} ${glob}`);
  for (const { file, owner, importers } of result.crossed) {
    console.error(`${owner} owns ${file}, which ${importers.join(", ")} also renders`);
  }
  const problems =
    result.unmapped.length + result.shared.length + result.unused.length + result.crossed.length;
  console.log(`${files.length} view files, ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
}
