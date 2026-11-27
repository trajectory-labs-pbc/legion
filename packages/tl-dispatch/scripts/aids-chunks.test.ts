import { expect, test } from "bun:test";
import type { Rollup } from "vite";

import { aidsChunkProblems } from "./aids-chunks";

const SRC = "/repo/src/";
const AIDS = `${SRC}parts/reading-aids/`;

interface Shape {
  modules: readonly string[];
  imports?: readonly string[];
  dynamicImports?: readonly string[];
  isEntry?: boolean;
  facade?: string;
}

/** A bundle of chunks by file name, as Rollup hands it to `generateBundle`. */
function bundleOf(shapes: Record<string, Shape>): Rollup.OutputBundle {
  return Object.fromEntries(
    Object.entries(shapes).map(([fileName, shape]) => [
      fileName,
      {
        type: "chunk",
        fileName,
        moduleIds: [...shape.modules],
        imports: [...(shape.imports ?? [])],
        dynamicImports: [...(shape.dynamicImports ?? [])],
        isEntry: shape.isEntry ?? false,
        isDynamicEntry: shape.facade !== undefined,
        facadeModuleId: shape.facade ?? null,
      } as unknown as Rollup.OutputChunk,
    ])
  );
}

const lazyAids = {
  modules: [`${AIDS}editor-aids.ts`, `${AIDS}aid-parts.tsx`, `${AIDS}aids.css?used`],
  facade: `${AIDS}editor-aids.ts`,
  imports: ["shared.js"],
};

test("passes the frame in the route chunk and the rest behind editor-aids' import()", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["hosts.js"] },
    "hosts.js": {
      facade: `${AIDS}hosts.tsx`,
      modules: [`${AIDS}hosts.tsx`, `${AIDS}aided-editor.ts`, `${AIDS}visit.ts`],
      imports: ["shared.js"],
      dynamicImports: ["editor-aids.js"],
    },
    "shared.js": { modules: [`${AIDS}parts-slot.ts`] },
    "editor-aids.js": lazyAids,
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([]);
});

test("names an aid that a static import pulls into the route chunk", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["hosts.js"] },
    "hosts.js": {
      facade: `${AIDS}hosts.tsx`,
      modules: [`${AIDS}hosts.tsx`, `${AIDS}editor-aids.ts`, `${AIDS}aid-parts.tsx`],
    },
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "hosts.js (loads without editor-aids.ts): editor-aids.ts",
    "hosts.js (loads without editor-aids.ts): aid-parts.tsx",
  ]);
});

test("names an aid that another lazy route reaches without editor-aids", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["other.js"] },
    "other.js": { facade: `${SRC}features/inbox/page.tsx`, modules: [`${AIDS}aid-parts.tsx`] },
    "editor-aids.js": lazyAids,
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "other.js (loads without editor-aids.ts): aid-parts.tsx",
  ]);
});

test("names a file outside the aids' folder that only the lazy aids read, in the route chunk", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["hosts.js"] },
    "hosts.js": {
      facade: `${AIDS}hosts.tsx`,
      modules: [
        `${AIDS}hosts.tsx`,
        `${SRC}data/document-reads.ts`,
        `${SRC}upstream/logic/reading-aids.ts`,
        `${SRC}upstream/editor/engine.ts`,
        `${SRC}upstream/editor/frame.ts`,
      ],
      dynamicImports: ["editor-aids.js"],
    },
    "editor-aids.js": lazyAids,
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "hosts.js (loads without editor-aids.ts): data/document-reads.ts",
    "hosts.js (loads without editor-aids.ts): upstream/logic/reading-aids.ts",
    "hosts.js (loads without editor-aids.ts): upstream/editor/engine.ts",
  ]);
});

test("names the compare worker's seam file in any chunk of the page's bundle", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["hosts.js"] },
    "hosts.js": {
      facade: `${AIDS}hosts.tsx`,
      modules: [`${AIDS}hosts.tsx`],
      dynamicImports: ["editor-aids.js"],
    },
    "editor-aids.js": {
      ...lazyAids,
      modules: [...lazyAids.modules, `${SRC}upstream/editor/worker.ts`],
    },
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "editor-aids.js (the worker's bundle alone): upstream/editor/worker.ts",
  ]);
});

test("names any aid, the frame too, in the entry's first load", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], imports: ["vendor.js"] },
    "vendor.js": { modules: [`${AIDS}parts-slot.ts`] },
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "vendor.js (the entry's first load): parts-slot.ts",
  ]);
});

test("names the aids that a static import of editor-aids' chunk loads", () => {
  const bundle = bundleOf({
    "index.js": { isEntry: true, modules: ["/repo/src/main.tsx"], dynamicImports: ["other.js"] },
    "other.js": {
      facade: `${SRC}features/inbox/page.tsx`,
      modules: [],
      imports: ["editor-aids.js"],
    },
    "editor-aids.js": lazyAids,
    "shared.js": { modules: [] },
  });
  expect(aidsChunkProblems(bundle, SRC)).toEqual([
    "editor-aids.js (loads without editor-aids.ts): editor-aids.ts",
    "editor-aids.js (loads without editor-aids.ts): aid-parts.tsx",
    "editor-aids.js (loads without editor-aids.ts): aids.css",
  ]);
});
