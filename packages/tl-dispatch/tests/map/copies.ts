// Upstream code this app copied, pinned by hash, so a change upstream is ported rather than lost.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { replacedViews } from "@/views";
import { git } from "../git";
import { PACKAGE_ROOT, REPO_ROOT, UPSTREAM_WEB } from "../source";
import { parseScript } from "../typescript";
import { routeTargets, upstreamAppFile } from "./source";

const pinsFile = join(import.meta.dir, "copies.json");
const pinsPath = relative(REPO_ROOT, pinsFile);
const appFile = relative(REPO_ROOT, upstreamAppFile);
const upstreamWeb = relative(REPO_ROOT, UPSTREAM_WEB);
const updateHint = (file: string, part: string) =>
  `run \`bun tests/map/copies.ts --update ${file} '${part}' --outcome ported --reason '<why>'\`, or \`--outcome closed\` for a change not ported`;
/** The files of this app that hold a pin's copy. */
export const copyFiles = (pin: Copy) => [pin.copy, ...(pin.also ?? [])];

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
  /** This app's other files holding code from the same part, when the copy spans several. */
  also?: string[];
  /** The last upstream commit that changed `file` when the copy was taken. */
  commit: string;
  sha256: string;
  /** Set by the sync that changed the pin: the change was ported, or closed with no port. */
  outcome?: "ported" | "closed";
  /** Why, for the sync that changed the pin. */
  reason?: string;
}

type Outcome = NonNullable<Copy["outcome"]>;
type Why = Pick<Copy, "outcome" | "reason">;
const isOutcome = (value: string | undefined): value is Outcome =>
  value === "ported" || value === "closed";

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
export function partText(file: string, part: string, given?: string): string | undefined {
  const text = given ?? readIfThere(join(REPO_ROOT, file));
  if (text === undefined) return undefined;
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

function readIfThere(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function readPins(text = readFileSync(pinsFile, "utf8")): Copy[] {
  return JSON.parse(text) as Copy[];
}

/** Each pinned part upstream changed or removed, with what to do. */
export function copyProblems(pins: readonly Copy[] = readPins(), read = partText): string[] {
  return pins.flatMap((pin) => {
    const text = read(pin.file, pin.part);
    if (text !== undefined && hash(text) === pin.sha256) return [];
    const since = `since ${pin.commit.slice(0, 12)}, which ${copyFiles(pin).join(" and ")} copies: port the change (git diff ${pin.commit.slice(0, 12)} -- ${pin.file})`;
    return [
      text === undefined
        ? `${pin.file} no longer has ${pin.part} ${since}, then remove or rename its entry in copies.json, and give the pin that replaces it an outcome and a reason`
        : `${pin.file} changed ${pin.part} ${since}, or close it, then ${updateHint(pin.file, pin.part)}`,
    ];
  });
}

/**
 * Each name a route element of app.tsx refers to that no pin covers, directly or through the
 * declarations it names: a page's lazy, and the imports a copied page's body draws.
 */
export function unpinnedRouteTargets(
  pins: readonly Copy[] = readPins(),
  targets: readonly string[] = routeTargets()
): string[] {
  const pinned = new Set(pins.filter((pin) => pin.file === appFile).map((pin) => pin.part));
  return targets
    .filter((name) => !pinned.has(name))
    .map(
      (name) =>
        `${appFile}: a route element refers to ${name}, itself or through a part it names, which copies.json does not pin: add {"file": "${appFile}", "part": "${name}", "copy": <the file of this app that holds its copy>} and run \`bun tests/map/copies.ts --update ${appFile} ${name}\``
    );
}

/** Each upstream view file of `replaced` that copies.json does not pin whole. */
export function unpinnedReplacedViews(
  pins: readonly Copy[] = readPins(),
  replaced: Readonly<Record<string, string>> = replacedViews
): string[] {
  const whole = new Map(pins.filter((pin) => pin.part === "*").map((pin) => [pin.file, pin]));
  return Object.entries(replaced).flatMap(([view, copy]) => {
    const file = `${upstreamWeb}/${view}`;
    const pin = whole.get(file);
    if (pin === undefined) {
      return [
        `${file} is in src/views.ts replacedViews, and copies.json does not pin it whole: add {"file": "${file}", "part": "*", "copy": "${copy}", "commit": "", "sha256": ""} and run \`bun tests/map/copies.ts --update ${file} '*'\``,
      ];
    }
    return pin.copy === copy
      ? []
      : [
          `${file}: src/views.ts replacedViews gives it to ${copy}, and its pin in copies.json to ${pin.copy}: make them agree`,
        ];
  });
}

const keyOf = (pin: Copy) => `${pin.file}\0${pin.part}`;
const nameOf = (pin: Copy) => `${pin.file} '${pin.part}'`;
const reasonOf = (pin: Copy) => pin.reason?.trim() ?? "";
const explained = (pin: Copy) => pin.outcome !== undefined && reasonOf(pin) !== "";

/**
 * Each way the pins fail to say why they changed since `base`, the pins of the merge base: a pin
 * hashed again with no outcome and reason of its own, an outcome or reason that is not one, and a
 * pin gone with no new or changed pin of its file or its copy that says why. A pin whose copy this
 * app no longer has may go with no record.
 */
export function unexplainedPins(
  pins: readonly Copy[],
  base: readonly Copy[],
  hasCopy = (copy: string) => existsSync(join(PACKAGE_ROOT, copy))
): string[] {
  const before = new Map(base.map((pin) => [keyOf(pin), pin]));
  const now = new Set(pins.map(keyOf));
  const changed = (pin: Copy, old = before.get(keyOf(pin))) =>
    old === undefined || old.sha256 !== pin.sha256 || old.commit !== pin.commit;
  const problems: string[] = [];
  for (const pin of pins) {
    if (pin.outcome !== undefined && !isOutcome(pin.outcome)) {
      problems.push(`${nameOf(pin)} has the outcome ${pin.outcome}: it is ported or closed`);
    }
    if (pin.reason !== undefined && reasonOf(pin) === "") {
      problems.push(`${nameOf(pin)} has an empty reason`);
    }
    const old = before.get(keyOf(pin));
    if (old === undefined || !changed(pin, old)) continue;
    const since = `since the base (${old.commit.slice(0, 12)} to ${pin.commit.slice(0, 12)})`;
    if (!explained(pin)) {
      problems.push(
        `${nameOf(pin)} was pinned again ${since} with no outcome or reason: ${updateHint(pin.file, pin.part)}`
      );
    } else if (reasonOf(pin) === reasonOf(old)) {
      problems.push(
        `${nameOf(pin)} was pinned again ${since} and keeps the base's reason: ${updateHint(pin.file, pin.part)}, with this change's reason`
      );
    }
  }
  for (const old of base) {
    const copies = copyFiles(old);
    if (now.has(keyOf(old)) || !copies.some(hasCopy)) continue;
    const heir = pins.find(
      (pin) =>
        (pin.file === old.file || copyFiles(pin).some((copy) => copies.includes(copy))) &&
        changed(pin) &&
        explained(pin) &&
        reasonOf(pin) !== reasonOf(old)
    );
    if (heir === undefined) {
      problems.push(
        `${nameOf(old)} is gone since the base, and no new or changed pin of ${old.file} or ${copies.join(" or ")} gives an outcome and a reason: give the pin that replaces it both`
      );
    }
  }
  return problems;
}

/** The pins at the merge base of HEAD and `target`; none when the base has no copies.json. */
export function basePins(target: string): Copy[] {
  const base = git(["merge-base", "HEAD", target]);
  if (!base.ok) throw new Error(`git merge-base HEAD ${target} failed: ${base.err}`);
  const at = `${base.out.trim()}:${pinsPath}`;
  if (!git(["cat-file", "-e", at]).ok) return [];
  const shown = git(["show", at]);
  if (!shown.ok) throw new Error(`git show ${at} failed: ${shown.err}`);
  return readPins(shown.out);
}

function lastCommit(file: string): string {
  const run = git(["log", "-1", "--format=%H", "--", file]);
  const commit = run.out.trim();
  if (!run.ok || commit === "") throw new Error(`git log found no commit for ${file}`);
  return commit;
}

/** The upstream diff behind a problem, for the log. */
export function upstreamDiff(pin: Copy): string {
  const run = git(["diff", pin.commit, "--", pin.file]);
  return run.ok
    ? run.out
    : `git diff ${pin.commit} failed (a shallow checkout lacks it): ${run.err}`;
}

/**
 * `pins` with the pin of `file` and `part` hashed again. The other pins keep their hash and
 * commit, so a part upstream also changed still fails until its own change is ported.
 */
export function repin(
  pins: readonly Copy[],
  file: string,
  part: string,
  why: Why = {},
  read = partText,
  commitOf = lastCommit
): Copy[] {
  if (!pins.some((pin) => pin.file === file && pin.part === part)) {
    throw new Error(`copies.json has no pin for ${part} of ${file}`);
  }
  return pins.map((pin) => {
    if (pin.file !== file || pin.part !== part) return pin;
    const text = read(file, part);
    if (text === undefined) throw new Error(`${file} has no ${part}: update copies.json by hand`);
    return { ...pin, commit: commitOf(file), sha256: hash(text), ...why };
  });
}

const usage = [
  "usage: bun tests/map/copies.ts --update <upstream file> <part> [--outcome ported|closed --reason <why>]",
  "       bun tests/map/copies.ts --check-base <ref>",
].join("\n");

/** The arguments of the command line, or undefined when they do not parse. */
export function parseUpdate(
  args: readonly string[]
): { file: string; part: string; why: Why } | undefined {
  const [flag, file, part, ...rest] = args;
  if (flag !== "--update" || file === undefined || part === undefined) return undefined;
  const why: Why = {};
  for (let index = 0; index < rest.length; index += 2) {
    const value = rest[index + 1];
    if (rest[index] === "--outcome" && isOutcome(value)) {
      why.outcome = value;
    } else if (rest[index] === "--reason" && value?.trim()) {
      why.reason = value.trim();
    } else {
      return undefined;
    }
  }
  if ((why.outcome === undefined) !== (why.reason === undefined)) return undefined;
  return { file, part, why };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const [command, target, ...rest] = args;
  const update = parseUpdate(args);
  if (command === "--check-base" && target !== undefined && rest.length === 0) {
    const problems = unexplainedPins(readPins(), basePins(target));
    for (const line of problems) console.error(line);
    if (problems.length > 0) process.exit(1);
    console.log(`${pinsPath}: each pin changed since ${target} names its outcome and reason`);
  } else if (update) {
    const { file, part, why } = update;
    writeFileSync(pinsFile, `${JSON.stringify(repin(readPins(), file, part, why), null, 2)}\n`);
    console.log(`${pinsPath}: pinned ${part} of ${file}`);
  } else {
    console.error(usage);
    process.exit(1);
  }
}
