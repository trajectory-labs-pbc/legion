// Writes the modules that load before first paint, so a check can compare them across builds.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { Plugin, Rollup } from "vite";

/** The part of a build's output this reads: each chunk, its modules and its static imports. */
export type Chunk = Pick<Rollup.OutputChunk, "type" | "isEntry" | "imports" | "moduleIds">;

/**
 * The modules of the entry chunk and of every chunk it imports statically: relative to `root`,
 * sorted, each once; a virtual module keeps its id.
 */
export function entryModules(
  bundle: Readonly<Record<string, Chunk | { type: "asset" }>>,
  root: string
): { modules: string[] } {
  const chunk = (name: string) => {
    const found = bundle[name];
    return found?.type === "chunk" ? found : undefined;
  };
  const entries = Object.keys(bundle).filter((name) => chunk(name)?.isEntry === true);
  const [entry, ...others] = entries;
  if (entry === undefined || others.length > 0) {
    throw new Error(`the build has ${entries.length} entry chunks, not one`);
  }
  const chunks: string[] = [];
  const visit = (name: string) => {
    if (chunks.includes(name)) return;
    chunks.push(name);
    for (const next of chunk(name)?.imports ?? []) visit(next);
  };
  visit(entry);
  const base = resolve(root);
  const modules = new Set(
    chunks.flatMap((name) =>
      (chunk(name)?.moduleIds ?? []).map((id) =>
        id.startsWith(base + sep) ? relative(base, id).split(sep).join("/") : id
      )
    )
  );
  return { modules: [...modules].sort() };
}

/** Writes `entryModules` of the build to `out`, outside the output folder that the image copies. */
export function writeEntryModules(root: string, out: string): Plugin {
  return {
    name: "write-entry-modules",
    apply: "build",
    generateBundle(_options, bundle) {
      const found = entryModules(bundle, root);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(found, null, 2)}\n`);
    },
  };
}
