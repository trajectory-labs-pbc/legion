import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { PACKAGE_ROOT, REPO_ROOT, UPSTREAM_WEB } from "./source";

const SKILLS = join(REPO_ROOT, ".agents/skills");
/** The skill folders this repository adds, which its allowlist names; any other is upstream's. */
const OWNED_SKILLS = readFileSync(join(REPO_ROOT, ".github/fork-allowlist.txt"), "utf8")
  .split("\n")
  .flatMap((line) => /^\.agents\/skills\/([\w-]+)\/$/.exec(line)?.[1] ?? []);
/** The first segment of a path the documents write from one of the roots below. */
const FIRST_SEGMENTS = new Set([
  ".agents",
  ".github",
  "docs",
  "features",
  "packages",
  "references",
  "scripts",
  "src",
  "tests",
  "web",
  ...OWNED_SKILLS,
]);
const FILE_NAME = /^[\w.-]+\.(tsx?|json|md|css|sh|ya?ml|txt|html|toml)$/;
const PATH = /^[\w.@-]+(\/[\w.@-]+)+\/?$/;
const UPSTREAM_ALIAS = "@upstream-dispatch/";

/** Every Markdown file the agents read for this app: the skills, and this package's AGENTS.md. */
export function agentDocuments(): string[] {
  const skills = OWNED_SKILLS.flatMap((skill) =>
    readdirSync(join(SKILLS, skill), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(entry.parentPath, entry.name))
  );
  return [join(PACKAGE_ROOT, "AGENTS.md"), ...skills].sort();
}

/** The inline code spans of a Markdown text, fenced blocks aside. */
function codeSpans(text: string): string[] {
  const prose = text.replace(/^```[\s\S]*?^```/gm, "");
  return [...prose.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? "");
}

/** The file names under a directory, to any depth, `node_modules` and `dist` aside. */
function fileNames(root: string): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else names.add(entry.name);
    }
  };
  walk(root);
  return names;
}

/** A path a document names; `bare` when it is a file name alone. */
interface Named {
  path: string;
  bare: boolean;
}

/** What a span names in the repository, or undefined when it names no path: a key, a class. */
function named(span: string): Named | undefined {
  if (/[*<>$\s]|\.\.\./.test(span)) return undefined;
  if (span.startsWith(UPSTREAM_ALIAS)) return { path: span, bare: false };
  if (span.startsWith("@")) return undefined;
  if (FILE_NAME.test(span)) return { path: span, bare: true };
  if (!PATH.test(span)) return undefined;
  const [first] = span.split("/");
  const last = basename(span);
  return FIRST_SEGMENTS.has(first ?? "") || FILE_NAME.test(last)
    ? { path: span, bare: false }
    : undefined;
}

/** The paths a span names: the span itself, or each path among the words of a command. */
function namedIn(span: string): Named[] {
  const words = /\s/.test(span) ? span.split(/\s+/).filter((word) => word.includes("/")) : [span];
  return words.flatMap((word) => named(word) ?? []);
}

/**
 * Each repository path a document names that does not exist. A path is read from the repository
 * root, this package, upstream's web app or its source, the skills folder, or the document's
 * own folder; a file named alone is one of this package, of upstream's web source's top level,
 * of the repository root, or beside the document.
 */
export function missingPaths(
  documents: readonly { file: string; text: string }[] = agentDocuments().map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }))
): string[] {
  const own = fileNames(PACKAGE_ROOT);
  const missing: string[] = [];
  for (const { file, text } of documents) {
    const roots = [
      REPO_ROOT,
      PACKAGE_ROOT,
      UPSTREAM_WEB,
      join(UPSTREAM_WEB, "../.."),
      SKILLS,
      dirname(file),
    ];
    for (const span of new Set(codeSpans(text))) {
      for (const name of namedIn(span)) {
        const exists = name.path.startsWith(UPSTREAM_ALIAS)
          ? ["", ".ts", ".tsx"].some((extension) =>
              existsSync(join(UPSTREAM_WEB, name.path.slice(UPSTREAM_ALIAS.length) + extension))
            )
          : name.bare
            ? own.has(name.path) ||
              [REPO_ROOT, UPSTREAM_WEB, dirname(file)].some((root) =>
                existsSync(join(root, name.path))
              )
            : roots.some((root) => existsSync(join(root, name.path)));
        if (!exists) {
          missing.push(`${relative(REPO_ROOT, file)} names ${name.path}, which does not exist`);
        }
      }
    }
  }
  return missing;
}
