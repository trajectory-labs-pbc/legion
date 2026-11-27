// Fails the build when a reading aid loads before its editor needs it: only the hosts' frame
// is in the route chunk, the rest loads with `editor-aids.ts`, and the entry's first load holds none.
import type { Plugin, Rollup } from "vite";

/** The modules of the aids that load with the hosts' route. */
const FRAME_MODULES: readonly string[] = [
  "hosts.tsx",
  "issue-host.tsx",
  "document-host.tsx",
  "aided-editor.ts",
  "parts-slot.ts",
  "visit.ts",
  "aid-commands.ts",
];

const LAZY_MODULE = "editor-aids.ts";

/** Each chunk that holds an aid where the rule refuses it, with the aid's file. */
export function aidsChunkProblems(bundle: Rollup.OutputBundle, aidsDir: string): string[] {
  const chunks = new Map(
    Object.values(bundle)
      .filter((output): output is Rollup.OutputChunk => output.type === "chunk")
      .map((chunk) => [chunk.fileName, chunk])
  );
  const lazy = [...chunks.values()].find(
    (chunk) => chunk.isDynamicEntry && chunk.facadeModuleId === `${aidsDir}${LAZY_MODULE}`
  );
  const aids = (chunk: Rollup.OutputChunk) =>
    chunk.moduleIds
      .map((id) => id.replace(/^\0/, "").replace(/\?.*$/, ""))
      .filter((id) => id.startsWith(aidsDir))
      .map((id) => id.slice(aidsDir.length));
  // The chunks a page loads from the entries by `follow`.
  const reached = (follow: (chunk: Rollup.OutputChunk) => readonly string[]) => {
    const seen = new Set<Rollup.OutputChunk>();
    const next = [...chunks.values()].filter((chunk) => chunk.isEntry);
    for (let chunk = next.pop(); chunk !== undefined; chunk = next.pop()) {
      if (seen.has(chunk)) continue;
      seen.add(chunk);
      for (const name of follow(chunk)) {
        const imported = chunks.get(name);
        if (imported !== undefined) next.push(imported);
      }
    }
    return seen;
  };
  const problems: string[] = [];
  for (const chunk of reached((chunk) => chunk.imports)) {
    for (const aid of aids(chunk))
      problems.push(`${chunk.fileName} (the entry's first load): ${aid}`);
  }
  // Every import but the aids' own import().
  const withoutTheAids = (chunk: Rollup.OutputChunk) => [
    ...chunk.imports,
    ...chunk.dynamicImports.filter((name) => name !== lazy?.fileName),
  ];
  for (const chunk of reached(withoutTheAids)) {
    for (const aid of aids(chunk).filter((aid) => !FRAME_MODULES.includes(aid))) {
      problems.push(`${chunk.fileName} (loads without ${LAZY_MODULE}): ${aid}`);
    }
  }
  return problems;
}

export function aidsChunks(aidsDir: string): Plugin {
  return {
    name: "reading-aids-chunks",
    apply: "build",
    // Before upstream's notices, so a refused chunk fails with this rule's error.
    enforce: "pre",
    generateBundle(_options, bundle) {
      const problems = aidsChunkProblems(bundle, aidsDir);
      if (problems.length > 0) {
        this.error(`a reading aid loads before its editor needs it: ${problems.join("; ")}`);
      }
    },
  };
}
