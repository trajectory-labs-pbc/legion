// Fails when a page loads before first paint: each page's route file loads it with import().
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { filesWith, importsOf, resolutionCache } from "../tests/imports";
import { EAGER } from "../tests/layers.table";
import { filesUnder, PACKAGE_ROOT, REPO_ROOT, TEST, UPSTREAM_WEB } from "../tests/source";
import type { entryModules } from "./entry-modules";

type EntryModules = ReturnType<typeof entryModules>;

// The build names modules from the repository root (vite.config.ts).
const PACKAGE = "packages/tl-dispatch/";
const FEATURE = /^src\/features\/[^/]+\//;
const ROUTE = /^src\/features\/[^/]+\/route\.tsx?$/;
const VIEW = /^src\/upstream\/views\//;

/**
 * The upstream module each seam view gives, by its path from the repository root, with the seam
 * file. A seam file that only re-exports leaves the build's list, so the upstream module stands
 * for it there.
 */
export function seamViews(): Map<string, string> {
  const disk = filesWith();
  const cache = resolutionCache();
  const views = new Map<string, string>();
  for (const file of filesUnder(PACKAGE_ROOT, "src/upstream/views")) {
    if (TEST.test(file.path)) continue;
    for (const entry of importsOf(join(PACKAGE_ROOT, file.path), disk, cache)) {
      if (entry.kind === "static" && entry.file?.startsWith(UPSTREAM_WEB) === true) {
        views.set(relative(REPO_ROOT, entry.file), file.path);
      }
    }
  }
  return views;
}

/**
 * The modules of a page among those that load before first paint: a feature's files but its
 * route file, a seam view, or the upstream module a seam view gives, except those `eager` names.
 */
export function eagerPages(
  entry: EntryModules,
  eager: Readonly<Record<string, string>> = EAGER,
  seams: ReadonlyMap<string, string> = seamViews()
): string[] {
  return entry.modules.flatMap((module) => {
    const seam = seams.get(module);
    if (seam !== undefined) {
      return Object.hasOwn(eager, seam) ? [] : [`${module}, the upstream view of ${seam}`];
    }
    if (!module.startsWith(PACKAGE)) return [];
    const path = module.slice(PACKAGE.length);
    const page = (FEATURE.test(path) && !ROUTE.test(path) && !TEST.test(path)) || VIEW.test(path);
    return page && !Object.hasOwn(eager, path) ? [module] : [];
  });
}

/** The modules `eager` names that do not load before first paint. */
export function missingEager(
  entry: EntryModules,
  eager: Readonly<Record<string, string>> = EAGER
): string[] {
  return Object.keys(eager).filter((path) => !entry.modules.includes(PACKAGE + path));
}

if (import.meta.main) {
  const path = process.argv[2] ?? join(import.meta.dir, "..", ".build", "entry-modules.json");
  const entry = JSON.parse(readFileSync(path, "utf8")) as EntryModules;
  const pages = eagerPages(entry);
  const missing = missingEager(entry);
  if (pages.length > 0) {
    console.error(`these page modules load before first paint:\n${pages.join("\n")}`);
  }
  if (missing.length > 0) {
    console.error(
      `EAGER names these, and they do not load before first paint:\n${missing.join("\n")}`
    );
  }
  if (pages.length > 0 || missing.length > 0) process.exit(1);
  console.log("only the pages EAGER names load before first paint");
}
