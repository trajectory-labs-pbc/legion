import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** A file of this package: its path from the package root, with `/`, and its text. */
export interface SourceFile {
  path: string;
  text: string;
}

export const PACKAGE_ROOT = join(import.meta.dir, "..");

const SOURCE = /\.(ts|tsx|css)$/;

/** Every source file under `src/`, tests left out. */
export function sourceFiles(root = PACKAGE_ROOT): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(join(root, "src"), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !SOURCE.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    const absolute = join(entry.parentPath, entry.name);
    files.push({
      path: relative(root, absolute).split(sep).join("/"),
      text: readFileSync(absolute, "utf8"),
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** The text with comments blanked, line breaks kept, so a rule reads code and not prose. */
export function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`\\])\/\/[^\n]*/g,
      (match, before: string) => before + " ".repeat(match.length - before.length)
    );
}

export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}
