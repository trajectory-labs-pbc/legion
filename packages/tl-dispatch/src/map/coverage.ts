import { shellViews, widgetViews } from "../views";
import { featureViews, readPages } from "./source";

export interface Owner {
  name: string;
  globs: readonly string[];
}

export interface Coverage {
  unmapped: string[];
  shared: { file: string; owners: string[] }[];
  /** Globs that match no view file: a folder upstream renamed or removed. */
  unused: { owner: string; glob: string }[];
}

/** Each page, the shell and each widget, with the upstream view files it owns. */
export function owners(): Owner[] {
  return [
    ...readPages().map((page) => ({ name: `page:${page.id}`, globs: page.views })),
    { name: "shell", globs: shellViews },
    ...Object.entries(widgetViews).map(([name, globs]) => ({ name: `widget:${name}`, globs })),
  ];
}

export function coverage(files: readonly string[], all: readonly Owner[]): Coverage {
  const matchers = all.flatMap((owner) =>
    owner.globs.map((glob) => ({ owner: owner.name, glob, matcher: new Bun.Glob(glob) }))
  );
  const used = new Set<string>();
  const unmapped: string[] = [];
  const shared: Coverage["shared"] = [];
  for (const file of files) {
    const hits = matchers.filter((entry) => entry.matcher.match(file));
    for (const hit of hits) used.add(`${hit.owner}\0${hit.glob}`);
    const names = [...new Set(hits.map((hit) => hit.owner))];
    if (names.length === 0) {
      unmapped.push(file);
    } else if (names.length > 1) {
      shared.push({ file, owners: names });
    }
  }
  const unused = matchers
    .filter((entry) => !used.has(`${entry.owner}\0${entry.glob}`))
    .map(({ owner, glob }) => ({ owner, glob }));
  return { unmapped, shared, unused };
}

if (import.meta.main) {
  const result = coverage(featureViews(), owners());
  for (const file of result.unmapped) console.error(`unmapped: ${file}`);
  for (const { file, owners: names } of result.shared) {
    console.error(`more than one owner: ${file} (${names.join(", ")})`);
  }
  for (const { owner, glob } of result.unused) console.error(`matches no file: ${owner} ${glob}`);
  const problems = result.unmapped.length + result.shared.length + result.unused.length;
  console.log(`${featureViews().length} view files, ${problems} problem(s)`);
  process.exit(problems === 0 ? 0 : 1);
}
