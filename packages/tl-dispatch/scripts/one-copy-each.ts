// Fails the build when the bundle holds two copies of a shared package, or a copy from the wrong install.
import type { Plugin } from "vite";

export interface SharedPackages {
  /** Packages the root install provides: this app's own install must not bundle one. */
  root: readonly string[];
  /** Packages both this app and packages/ui install: the bundle takes this app's copy alone. */
  ui: readonly string[];
}

/** Each shared package bundled from more than one directory, or from the wrong install. */
export function bundleCopyProblems(
  moduleIds: Iterable<string>,
  packages: SharedPackages,
  ownInstall: string
): string[] {
  const names = [...packages.root, ...packages.ui];
  const copies = new Map<string, Set<string>>();
  for (const module of moduleIds) {
    // A plugin's virtual module wraps a file's id in \0 and a query.
    const id = module.replace(/^\0/, "").replace(/\?.*$/, "");
    for (const name of names) {
      const index = id.lastIndexOf(`/node_modules/${name}/`);
      if (index < 0) continue;
      const dir = id.slice(0, index + `/node_modules/${name}`.length);
      copies.set(name, (copies.get(name) ?? new Set()).add(dir));
    }
  }
  const own = (dir: string) => dir.startsWith(ownInstall);
  return [...copies]
    .filter(
      ([name, dirs]) =>
        dirs.size > 1 || (packages.ui.includes(name) ? ![...dirs].every(own) : [...dirs].some(own))
    )
    .map(([name, dirs]) => `${name} (${[...dirs].join(", ")})`);
}

export function oneCopyEach(packages: SharedPackages, ownInstall: string): Plugin {
  return {
    name: "one-copy-each",
    apply: "build",
    generateBundle() {
      const ids = [...this.getModuleIds()];
      const problems = bundleCopyProblems(ids, packages, ownInstall);
      if (problems.length > 0) {
        this.error(`not one copy each, from the right install: ${problems.join("; ")}`);
      }
      const bundled = (names: readonly string[]) =>
        names.filter((name) => ids.some((id) => id.includes(`/node_modules/${name}/`))).length;
      console.log(
        `one-copy-each: ${bundled(packages.root)} root packages and ${bundled(packages.ui)} UI packages bundled, one copy each`
      );
    },
  };
}
