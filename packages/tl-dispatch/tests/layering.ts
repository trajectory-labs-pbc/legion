import { dirname, join, normalize } from "node:path";

import { lineOf, type SourceFile, withoutComments } from "./source";

export interface LayerViolation {
  file: string;
  line: number;
  specifier: string;
  rule: string;
}

const IMPORT =
  /\bimport\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?["']([^"']+)["']|\bexport\s+(?:type\s+)?[^'"`;]*?\s+from\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|@import\s+["']([^"']+)["']/g;

/** Where upstream's web source sits, from this package's root. */
const UPSTREAM_WEB = "../dispatch/web/src";
const ROUTERS = /^(react-router(-dom)?|@tanstack\/[a-z-]*router[a-z-]*)(\/|$)/;

/** The path a specifier names, from this package's root, or undefined for a package. */
function resolved(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("@upstream-dispatch")) {
    return normalize(join(UPSTREAM_WEB, specifier.slice("@upstream-dispatch".length)));
  }
  if (specifier.startsWith(".")) return normalize(join(dirname(file), specifier));
  return undefined;
}

export function importsOf(file: SourceFile): { specifier: string; line: number }[] {
  const code = withoutComments(file.text);
  return [...code.matchAll(IMPORT)].map((match) => ({
    specifier: (match[1] ?? match[2] ?? match[3] ?? match[4]) as string,
    line: lineOf(code, match.index),
  }));
}

/** Imports that cross a layer: see each rule's text. */
export function layerViolations(files: readonly SourceFile[]): LayerViolation[] {
  const violations: LayerViolation[] = [];
  for (const file of files) {
    for (const { specifier, line } of importsOf(file)) {
      const target = resolved(file.path, specifier)?.replace(/\.(tsx?|jsx?)$/, "");
      const refuse = (rule: string) => violations.push({ file: file.path, line, specifier, rule });
      if (target === normalize(`${UPSTREAM_WEB}/app`)) {
        refuse(
          "upstream's app.tsx opens a second sign-in channel when it loads; copy what the shell needs"
        );
      }
      if (file.path.startsWith("src/ui/")) {
        if (
          specifier.startsWith("@upstream-dispatch") ||
          (target !== undefined && !target.startsWith("src/ui"))
        ) {
          refuse("src/ui holds components only: it imports nothing outside src/ui");
        } else if (ROUTERS.test(specifier) || specifier.startsWith("@tanstack/react-query")) {
          refuse("src/ui holds components only: no router, no data");
        }
      }
      if (file.path.startsWith("src/commands/") && ROUTERS.test(specifier)) {
        refuse("a command takes callbacks named for what they do; it never imports navigation");
      }
    }
  }
  return violations;
}
