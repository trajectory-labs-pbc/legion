// Fails the build when the bundle holds two copies of a root package, or this app's own copy.
import type { Plugin } from "vite";

/** Each root package bundled from more than one directory, or from this app's own install. */
export function bundleCopyProblems(
  moduleIds: Iterable<string>,
  rootPackages: readonly string[],
  ownInstall: string
): string[] {
  const copies = new Map<string, Set<string>>();
  for (const module of moduleIds) {
    // A plugin's virtual module wraps a file's id in \0 and a query.
    const id = module.replace(/^\0/, "").replace(/\?.*$/, "");
    for (const name of rootPackages) {
      const index = id.lastIndexOf(`/node_modules/${name}/`);
      if (index < 0) continue;
      const dir = id.slice(0, index + `/node_modules/${name}`.length);
      copies.set(name, (copies.get(name) ?? new Set()).add(dir));
    }
  }
  return [...copies]
    .filter(([, dirs]) => dirs.size > 1 || [...dirs].some((dir) => dir.startsWith(ownInstall)))
    .map(([name, dirs]) => `${name} (${[...dirs].join(", ")})`);
}

export function oneCopyEach(rootPackages: readonly string[], ownInstall: string): Plugin {
  return {
    name: "one-copy-each",
    apply: "build",
    generateBundle() {
      const ids = [...this.getModuleIds()];
      const problems = bundleCopyProblems(ids, rootPackages, ownInstall);
      if (problems.length > 0) {
        this.error(`not one root-install copy each: ${problems.join("; ")}`);
      }
      const bundled = rootPackages.filter((name) =>
        ids.some((id) => id.includes(`/node_modules/${name}/`))
      );
      console.log(`one-copy-each: ${bundled.length} root packages bundled, one copy each`);
    },
  };
}
