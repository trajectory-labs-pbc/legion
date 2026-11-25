import { join, sep } from "node:path";

import {
  filesWith,
  type Import,
  importsOf,
  ownFiles,
  packageRelative,
  resolutionCache,
} from "./imports";
import { PACKAGE_ROOT, type SourceFile, UPSTREAM_WEB } from "./source";

export interface LayerViolation {
  file: string;
  line: number;
  specifier: string;
  rule: string;
}

const SRC = join(PACKAGE_ROOT, "src");
const ROUTERS = /^(react-router(-dom)?|@tanstack\/[a-z-]*router[a-z-]*)$/;
const DATA = /^@tanstack\/react-query$/;
/** Upstream's app opens a second sign-in channel when it loads; its entry loads the app. */
const NEVER_LOADED = new Map([
  [join(UPSTREAM_WEB, "app.tsx"), "app.tsx"],
  [join(UPSTREAM_WEB, "main.tsx"), "main.tsx"],
]);
const RUNTIME = new Set(["static", "dynamic", "require"]);

const own = (path: string) => path.startsWith(SRC + sep);
const followed = (path: string) => own(path) || path.startsWith(UPSTREAM_WEB + sep);

/** The folder under `src/` a file sits in, by path segment: `src/ui/button.tsx` is in `ui`. */
export function layerOf(path: string): string | undefined {
  const segments = packageRelative(path).split("/");
  return segments[0] === "src" && segments.length > 2 ? segments[1] : undefined;
}

function rulesFor(entry: Import): string[] {
  const rules: string[] = [];
  const layer = layerOf(entry.from);
  if (entry.glob === true) {
    rules.push("import.meta.glob names files by pattern, so no rule can read them; import each");
  } else if (entry.specifier === undefined) {
    rules.push(
      "a non-literal import() or require() names no module a rule can read; write the path"
    );
  } else if (!entry.resolved) {
    rules.push("the specifier resolves to no file and no package, so no rule can read it");
  }
  const target = entry.file === undefined ? undefined : layerOf(entry.file);
  if (layer === "ui") {
    if (entry.file !== undefined && (!own(entry.file) || target !== "ui")) {
      rules.push("src/ui holds components only: it imports nothing outside src/ui");
    }
    if (entry.pkg !== undefined && (ROUTERS.test(entry.pkg) || DATA.test(entry.pkg))) {
      rules.push("src/ui holds components only: no router, no data");
    }
  }
  if (layer !== "navigation" && entry.pkg !== undefined && ROUTERS.test(entry.pkg)) {
    rules.push("only src/navigation imports the router, so a router move changes one folder");
  }
  if (
    layer === "navigation" &&
    entry.file !== undefined &&
    own(entry.file) &&
    (target === "pages" || target === "shell")
  ) {
    rules.push("navigation names no page and no shell: the app hands it its pages");
  }
  if (layer === "commands") {
    if (entry.pkg !== undefined && ROUTERS.test(entry.pkg)) {
      rules.push("a command takes callbacks named for what they do; it never imports navigation");
    }
    if (entry.file !== undefined && own(entry.file) && (target === "shell" || target === "pages")) {
      rules.push("commands sit below the shell and the pages; they import neither");
    }
  }
  return rules;
}

const upstreamImports = new Map<string, Import[]>();

/**
 * Every layer rule `files` and the modules they reach break. Imports are resolved as the build
 * resolves them and followed through upstream's code, so a chain that reaches upstream's app
 * or entry is refused at the file of this app it starts from.
 */
export function layerViolations(files: readonly SourceFile[]): LayerViolation[] {
  const overlay = ownFiles(files);
  const disk = filesWith(overlay);
  const cache = resolutionCache();
  const importsFor = (path: string): Import[] => {
    if (own(path)) return importsOf(path, disk, cache);
    let found = upstreamImports.get(path);
    if (found === undefined) {
      found = importsOf(path, filesWith(), resolutionCache());
      upstreamImports.set(path, found);
    }
    return found;
  };

  const violations: LayerViolation[] = [];
  const reachedBy = new Map<string, Import>();
  const queue = [...overlay.keys()];
  const seen = new Set(queue);
  for (let index = 0; index < queue.length; index += 1) {
    const path = queue[index] as string;
    for (const entry of importsFor(path)) {
      if (own(path)) {
        for (const rule of rulesFor(entry)) {
          violations.push({
            file: packageRelative(path),
            line: entry.line,
            specifier: entry.specifier ?? "(not a literal)",
            rule,
          });
        }
      }
      if (entry.file === undefined || !RUNTIME.has(entry.kind) || !followed(entry.file)) continue;
      if (seen.has(entry.file)) continue;
      seen.add(entry.file);
      reachedBy.set(entry.file, entry);
      queue.push(entry.file);
    }
  }

  for (const [target, name] of NEVER_LOADED) {
    const chain: Import[] = [];
    for (
      let entry = reachedBy.get(target);
      entry !== undefined;
      entry = reachedBy.get(entry.from)
    ) {
      chain.unshift(entry);
    }
    const first = chain[0];
    if (first === undefined) continue;
    violations.push({
      file: packageRelative(first.from),
      line: first.line,
      specifier: first.specifier ?? "(not a literal)",
      rule: `reaches upstream's ${name}, which opens a second sign-in channel when it loads: ${[
        first.from,
        ...chain.map((entry) => entry.file as string),
      ]
        .map(packageRelative)
        .join(" > ")}`,
    });
  }
  return violations;
}
