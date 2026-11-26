import { expect, test } from "bun:test";
import { join } from "node:path";

import {
  filesWith,
  importsOf,
  ownOrUpstream,
  packageRelative,
  reach,
  resolutionCache,
} from "./imports";
import { PACKAGE_ROOT, UPSTREAM_WEB } from "./source";

test("SHL-19 the app loads every kind of write before any page, so a reload's kept write finds its kind", () => {
  // Upstream's list of the modules that each define a kind of write.
  const kinds = importsOf(
    join(UPSTREAM_WEB, "features/writes/kinds.ts"),
    filesWith(),
    resolutionCache()
  ).map(({ file, specifier }) => file ?? `(unresolved) ${specifier}`);
  expect(kinds.length).toBeGreaterThan(0);
  // What loads before any page: the entry's static imports, followed until every kind is in.
  const { reached } = reach(
    [join(PACKAGE_ROOT, "src/main.tsx")],
    (entry) => entry.kind === "static" && entry.file !== undefined && ownOrUpstream(entry.file),
    { done: (loaded) => kinds.every((kind) => loaded.has(kind)) }
  );
  expect(kinds.filter((kind) => !reached.has(kind)).map(packageRelative)).toEqual([]);
});
