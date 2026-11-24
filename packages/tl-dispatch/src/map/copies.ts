// Upstream code this app copied, pinned by hash, so a change upstream is ported rather than lost.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { packageRoot } from "./source";

export const repoRoot = join(packageRoot, "../..");
const pinsFile = join(import.meta.dir, "copies.json");

export interface Copy {
  /** Upstream's file, from the repository root. */
  file: string;
  /**
   * `*` for the whole file, `script` for an HTML file's inline scripts, `default.<key>` for a key of
   * the object the default export passes, else a top-level declaration's name.
   */
  part: string;
  /** This app's file holding the copy. */
  copy: string;
  /** The last upstream commit that changed `file` when the copy was taken. */
  commit: string;
  sha256: string;
}

function declarationText(source: ts.SourceFile, part: string): string | undefined {
  for (const statement of source.statements) {
    if (part.startsWith("default.") && ts.isExportAssignment(statement)) {
      let value = statement.expression;
      if (ts.isCallExpression(value) && value.arguments[0]) value = value.arguments[0];
      if (!ts.isObjectLiteralExpression(value)) return undefined;
      const entry = value.properties.find(
        (property) => property.name?.getText(source) === part.slice("default.".length)
      );
      return entry?.getText(source);
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === part
    ) {
      return statement.getText(source);
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === part
      )
    ) {
      return statement.getText(source);
    }
  }
  return undefined;
}

/** The text of one part of a file, or undefined when the file no longer has it. */
export function partText(
  file: string,
  part: string,
  text = readFileSync(join(repoRoot, file), "utf8")
): string | undefined {
  if (part === "*") return text;
  if (part === "script") {
    const scripts = [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    return scripts.length > 0 ? scripts.map((match) => match[1]).join("\n") : undefined;
  }
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return declarationText(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind), part);
}

export const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export function readPins(): Copy[] {
  return JSON.parse(readFileSync(pinsFile, "utf8")) as Copy[];
}

/** Each pinned part upstream changed or removed, with what to do. */
export function copyProblems(pins: readonly Copy[] = readPins(), read = partText): string[] {
  return pins.flatMap((pin) => {
    const text = read(pin.file, pin.part);
    if (text !== undefined && hash(text) === pin.sha256) return [];
    const change = text === undefined ? "no longer has" : "changed";
    return [
      `${pin.file} ${change} ${pin.part} since ${pin.commit.slice(0, 12)}, which ${pin.copy} copies: port the change (git diff ${pin.commit.slice(0, 12)} -- ${pin.file}), then run \`bun src/map/copies.ts --update\``,
    ];
  });
}

function lastCommit(file: string): string {
  const run = Bun.spawnSync(["git", "log", "-1", "--format=%H", "--", file], { cwd: repoRoot });
  const commit = run.stdout.toString().trim();
  if (run.exitCode !== 0 || commit === "") throw new Error(`git log found no commit for ${file}`);
  return commit;
}

/** The upstream diff behind a problem, for the log. */
export function upstreamDiff(pin: Copy): string {
  const run = Bun.spawnSync(["git", "diff", pin.commit, "--", pin.file], { cwd: repoRoot });
  return run.exitCode === 0
    ? run.stdout.toString()
    : `git diff ${pin.commit} failed (a shallow checkout lacks it): ${run.stderr.toString().trim()}`;
}

if (import.meta.main && process.argv.includes("--update")) {
  const pins = readPins().map((pin) => {
    const text = partText(pin.file, pin.part);
    if (text === undefined)
      throw new Error(`${pin.file} has no ${pin.part}: update copies.json by hand`);
    return { ...pin, commit: lastCommit(pin.file), sha256: hash(text) };
  });
  writeFileSync(pinsFile, `${JSON.stringify(pins, null, 2)}\n`);
  console.log(`${relative(process.cwd(), pinsFile)}: ${pins.length} parts pinned`);
}
