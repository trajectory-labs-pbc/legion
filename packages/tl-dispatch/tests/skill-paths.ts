import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { PACKAGE_ROOT, REPO_ROOT } from "./source";

const SKILLS = join(REPO_ROOT, ".agents/skills");
/** The skill folders an allowlist names, each line read as `check-fork-allowlist.sh` reads it. */
export function ownedSkills(allowlist: string): string[] {
  return allowlist
    .split("\n")
    .flatMap(
      (line) => /^\.agents\/skills\/([\w-]+)\/$/.exec(line.replace(/#.*/, "").trim())?.[1] ?? []
    );
}

/** The skill folders this repository adds; any other is upstream's. */
const OWNED_SKILLS = ownedSkills(
  readFileSync(join(REPO_ROOT, ".github/fork-allowlist.txt"), "utf8")
);
/** The first segment of a path the documents write, when its last segment is not a file name. */
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

/** The skills of this repository a text does not name as `.agents/skills/<skill>/SKILL.md`. */
export function skillsNotNamed(text: string): string[] {
  const spans = new Set(codeSpans(text));
  return OWNED_SKILLS.filter((skill) => !spans.has(`.agents/skills/${skill}/SKILL.md`));
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

/** The path a span names, or undefined when it names none: a key, a class, a placeholder. */
function named(span: string): string | undefined {
  if (/[*<>$]|\.\.\./.test(span)) return undefined;
  if (span.startsWith(UPSTREAM_ALIAS)) return span;
  if (span.startsWith("@")) return undefined;
  if (FILE_NAME.test(span)) return span;
  if (!PATH.test(span)) return undefined;
  const [first] = span.split("/");
  return FIRST_SEGMENTS.has(first ?? "") || FILE_NAME.test(basename(span)) ? span : undefined;
}

/** The paths a span names: the span itself, or each path among the words of a command. */
function namedIn(span: string): string[] {
  const words = /\s/.test(span) ? span.split(/\s+/).filter((word) => word.includes("/")) : [span];
  return words.flatMap((word) => named(word) ?? []);
}

/** The skill folder a document is in, or the document's own folder when it is in none. */
function skillFolder(document: string): string {
  const [skill] = relative(SKILLS, document).split("/");
  return skill && skill !== ".." ? join(SKILLS, skill) : dirname(document);
}

/**
 * Whether a path a document names exists, read as this package's `AGENTS.md` says, and an
 * `@upstream-dispatch/` module as the build resolves it.
 */
function exists(path: string, document: string, own: ReadonlySet<string>): boolean {
  if (path.startsWith(UPSTREAM_ALIAS)) {
    try {
      Bun.resolveSync(path, PACKAGE_ROOT);
      return true;
    } catch {
      return false;
    }
  }
  if (!path.includes("/")) {
    return (
      own.has(path) || [dirname(document), REPO_ROOT].some((root) => existsSync(join(root, path)))
    );
  }
  const first = path.split("/")[0];
  const root =
    first === "src" || first === "tests"
      ? PACKAGE_ROOT
      : first === "references"
        ? skillFolder(document)
        : REPO_ROOT;
  return existsSync(join(root, path));
}

/** A path a document names that does not exist. */
export interface MissingPath {
  /** The document, from the repository root. */
  document: string;
  path: string;
}

/** Each path a document names in an inline code span that does not exist. */
export function missingPaths(
  documents: readonly { file: string; text: string }[] = agentDocuments().map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }))
): MissingPath[] {
  const own = fileNames(PACKAGE_ROOT);
  return documents.flatMap(({ file, text }) =>
    [...new Set(codeSpans(text))]
      .flatMap(namedIn)
      .filter((path) => !exists(path, file, own))
      .map((path) => ({ document: relative(REPO_ROOT, file), path }))
  );
}
