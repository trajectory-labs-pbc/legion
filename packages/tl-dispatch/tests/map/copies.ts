// Upstream code this app copied, pinned by hash, so a change upstream is ported rather than lost.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { REPO_ROOT } from "../source";
import { parseScript } from "../typescript";
import { routeTargets, upstreamAppFile } from "./source";

const pinsFile = join(import.meta.dir, "copies.json");
const appFile = relative(REPO_ROOT, upstreamAppFile);

export interface Copy {
  /** Upstream's file, from the repository root. */
  file: string;
  /**
   * `*` for the whole file, `script` for an HTML file's inline scripts, `default.<key>` for a key of
   * the object the default export passes, else a top-level declaration's or import's name.
   */
  part: string;
  /** This app's file holding the copy. */
  copy: string;
  /** The last upstream commit that changed `file` when the copy was taken. */
  commit: string;
  sha256: string;
}

/**
 * A node's tokens, without what a formatter changes: spacing, comments, semicolons, trailing
 * commas, quote style and the parentheses around JSX.
 */
export function canonical(node: ts.Node, source: ts.SourceFile): string {
  const tokens: string[] = [];
  const visit = (current: ts.Node): void => {
    if (ts.isParenthesizedExpression(current) && isJsx(current.expression)) {
      visit(current.expression);
      return;
    }
    const children = current.getChildren(source);
    if (children.length === 0) {
      tokens.push(tokenText(current, source));
      return;
    }
    children.forEach((child, index) => {
      if (child.kind >= ts.SyntaxKind.FirstJSDocNode && child.kind <= ts.SyntaxKind.LastJSDocNode) {
        return;
      }
      if (child.kind === ts.SyntaxKind.SemicolonToken) return;
      if (child.kind === ts.SyntaxKind.CommaToken && index === children.length - 1) return;
      visit(child);
    });
  };
  visit(node);
  return tokens.filter((token) => token !== "").join(" ");
}

const isJsx = (node: ts.Node): boolean =>
  ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);

function tokenText(node: ts.Node, source: ts.SourceFile): string {
  if (ts.isStringLiteral(node)) return JSON.stringify(node.text);
  if (ts.isJsxText(node)) return node.text.replace(/\s+/g, " ").trim();
  if (node.kind === ts.SyntaxKind.EndOfFileToken) return "";
  return node.getText(source);
}

/** Where an import binds `name`: its module and the name it takes from it. */
function importBinding(source: ts.SourceFile, name: string): string | undefined {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const from = JSON.stringify((statement.moduleSpecifier as ts.StringLiteral).text);
    const clause = statement.importClause;
    if (clause.name?.text === name) return `import default from ${from}`;
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings) && bindings.name.text === name) {
      return `import * from ${from}`;
    }
    if (bindings && ts.isNamedImports(bindings)) {
      const element = bindings.elements.find((entry) => entry.name.text === name);
      if (element) return `import ${(element.propertyName ?? element.name).text} from ${from}`;
    }
  }
  return undefined;
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
      return entry && canonical(entry, source);
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === part
    ) {
      return canonical(statement, source);
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === part
      )
    ) {
      return canonical(statement, source);
    }
  }
  return importBinding(source, part);
}

/** One part of a file with its formatting removed, or undefined when the file no longer has it. */
export function partText(
  file: string,
  part: string,
  text = readFileSync(join(REPO_ROOT, file), "utf8")
): string | undefined {
  if (part === "script") {
    const scripts = [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    if (scripts.length === 0) return undefined;
    return scripts
      .map((match) => {
        const source = parseScript("script.ts", match[1] ?? "");
        return canonical(source, source);
      })
      .join("\n");
  }
  const source = parseScript(file, text);
  return part === "*" ? canonical(source, source) : declarationText(source, part);
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
      `${pin.file} ${change} ${pin.part} since ${pin.commit.slice(0, 12)}, which ${pin.copy} copies: port the change (git diff ${pin.commit.slice(0, 12)} -- ${pin.file}), then run \`bun tests/map/copies.ts --update\``,
    ];
  });
}

/** Each name a route element of app.tsx refers to that no pin covers. */
export function unpinnedRouteTargets(
  pins: readonly Copy[] = readPins(),
  targets: readonly string[] = routeTargets()
): string[] {
  const pinned = new Set(pins.filter((pin) => pin.file === appFile).map((pin) => pin.part));
  return targets
    .filter((name) => !pinned.has(name))
    .map(
      (name) =>
        `${appFile}: a route element refers to ${name}, which copies.json does not pin: add {"file": "${appFile}", "part": "${name}", "copy": <the page file that draws it>} and run \`bun tests/map/copies.ts --update\``
    );
}

function lastCommit(file: string): string {
  const run = Bun.spawnSync(["git", "log", "-1", "--format=%H", "--", file], { cwd: REPO_ROOT });
  const commit = run.stdout.toString().trim();
  if (run.exitCode !== 0 || commit === "") throw new Error(`git log found no commit for ${file}`);
  return commit;
}

/** The upstream diff behind a problem, for the log. */
export function upstreamDiff(pin: Copy): string {
  const run = Bun.spawnSync(["git", "diff", pin.commit, "--", pin.file], { cwd: REPO_ROOT });
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
