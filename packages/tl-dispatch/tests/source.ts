import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** A file of this package: its path from the package root, with `/`, and its text. */
export interface SourceFile {
  path: string;
  text: string;
}

export const PACKAGE_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
export const REPO_ROOT = join(PACKAGE_ROOT, "../..");
/** The UI package's theme, which holds every token the app's classes may name. */
export const UI_STYLESHEET = join(PACKAGE_ROOT, "../ui/src/styles/theme.css");
/** Upstream's web app, whose pages this app shows and whose code the checks read. */
export const UPSTREAM_WEB = join(PACKAGE_ROOT, "../dispatch/web/src");
/** Upstream's document editor, whose classes upstream's pages draw. */
export const PROOF_EDITOR_SRC = join(PACKAGE_ROOT, "../proof-editor/src");
/** The app's sources, and the stylesheet the build compiles from them. */
export const SRC_DIR = join(PACKAGE_ROOT, "src");
export const APP_STYLESHEET = join(SRC_DIR, "styles.css");

const SOURCE = /\.(tsx?|[cm]?jsx?|css)$/;

/** Every script and stylesheet under `src/`, tests left out. */
export function sourceFiles(root = PACKAGE_ROOT): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(join(root, "src"), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !SOURCE.test(entry.name) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      continue;
    }
    const absolute = join(entry.parentPath, entry.name);
    files.push({
      path: relative(root, absolute).split(sep).join("/"),
      text: readFileSync(absolute, "utf8"),
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
