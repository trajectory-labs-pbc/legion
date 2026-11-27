import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { importedPath, parseCss } from "./css";
import { PACKAGE_ROOT, type SourceFile, SRC_DIR, UPSTREAM_WEB } from "./source";
import { literal, parseScript } from "./typescript";

export type ImportKind = "static" | "type" | "dynamic" | "require" | "css";

/** One import, as written and as resolved. */
export interface Import {
  /** The importing file, absolute. */
  from: string;
  /** The specifier, or undefined when it is not a literal (`import(name)`). */
  specifier: string | undefined;
  line: number;
  kind: ImportKind;
  /** The file it resolves to, absolute, when it is a file of this repository outside node_modules. */
  file: string | undefined;
  /** The package a bare specifier names, whether or not it is installed. */
  pkg: string | undefined;
  /** Whether it resolves to a file or an installed package. */
  resolved: boolean;
  /** `import.meta.glob`, which names files by pattern. */
  glob?: true;
}

/** A source file read from disk or given in memory, by absolute path. */
export interface Files {
  text(path: string): string | undefined;
  isFile(path: string): boolean;
  exists(path: string): boolean;
}

const ALIASES: readonly [string, string][] = [["@upstream-dispatch", UPSTREAM_WEB]];

const config = ts.readConfigFile(join(PACKAGE_ROOT, "tsconfig.json"), ts.sys.readFile);
const OPTIONS: ts.CompilerOptions = {
  ...ts.parseJsonConfigFileContent(config.config, ts.sys, PACKAGE_ROOT).options,
  allowJs: true,
  resolveJsonModule: true,
};

export function packageRelative(path: string): string {
  return relative(PACKAGE_ROOT, path).split(sep).join("/");
}

/** The files on disk, with `overlay` (absolute path to text) read in their place. */
export function filesWith(overlay: ReadonlyMap<string, string> = new Map()): Files {
  const dirs = new Set([...overlay.keys()].flatMap((path) => ancestors(path)));
  return {
    text: (path) => overlay.get(path) ?? (isFile(path) ? readFileSync(path, "utf8") : undefined),
    isFile: (path) => overlay.has(path) || isFile(path),
    exists: (path) => overlay.has(path) || dirs.has(path) || existsSync(path),
  };
}

function ancestors(path: string): string[] {
  const found: string[] = [];
  for (let dir = dirname(path); dir !== dirname(dir); dir = dirname(dir)) found.push(dir);
  return found;
}

/** Whether a file is there; false where none can be read: missing, or under a file (ENOTDIR). */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function packageName(specifier: string): string | undefined {
  if (/^(\.|\/|[a-z]:)/i.test(specifier)) return undefined;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Resolves a specifier the way the build does: tsconfig paths, the Vite alias, then packages. */
function resolveSpecifier(
  specifier: string,
  from: string,
  files: Files,
  cache: ts.ModuleResolutionCache
): { file: string | undefined; pkg: string | undefined; resolved: boolean } {
  const bare = specifier.replace(/\?.*$/, "");
  const alias = ALIASES.find(([name]) => bare === name || bare.startsWith(`${name}/`));
  const host: ts.ModuleResolutionHost = {
    fileExists: (path) => files.isFile(path),
    readFile: (path) => files.text(path),
    directoryExists: (path) => files.exists(path),
    realpath: (path) => path,
    getCurrentDirectory: () => PACKAGE_ROOT,
  };
  const resolved = ts.resolveModuleName(bare, from, OPTIONS, host, cache).resolvedModule;
  if (resolved !== undefined && !resolved.isExternalLibraryImport) {
    return { file: resolve(resolved.resolvedFileName), pkg: undefined, resolved: true };
  }
  // Stylesheets and assets: a relative or aliased path names a file as it is.
  const direct = bare.startsWith(".")
    ? resolve(dirname(from), bare)
    : alias === undefined
      ? undefined
      : join(alias[1], bare.slice(alias[0].length));
  if (direct !== undefined) {
    const found = files.isFile(direct);
    return { file: found ? direct : undefined, pkg: undefined, resolved: found };
  }
  const pkg = packageName(bare);
  if (resolved !== undefined) return { file: undefined, pkg, resolved: true };
  try {
    const found = Bun.resolveSync(bare, dirname(from));
    return found.includes(`${sep}node_modules${sep}`)
      ? { file: undefined, pkg, resolved: true }
      : { file: resolve(found), pkg: undefined, resolved: true };
  } catch {
    return { file: undefined, pkg, resolved: false };
  }
}

/** The imports a script file writes: static, re-exports, `import()`, `require`, and type-only. */
type Written = Omit<Import, "file" | "pkg" | "resolved">;

/** `{ type A, type B }`: the build drops an import or re-export that names only types. */
const allTypes = (elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>) =>
  elements.length > 0 && elements.every((element) => element.isTypeOnly);

function scriptImports(path: string, text: string): Written[] {
  const source = parseScript(path, text);
  const found: Written[] = [];
  const add = (
    node: ts.Node,
    specifier: string | undefined,
    importKind: ImportKind,
    glob = false
  ) =>
    found.push({
      from: path,
      specifier,
      kind: importKind,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      ...(glob ? { glob: true as const } : {}),
    });
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const typeOnly =
        clause?.isTypeOnly === true ||
        (clause?.name === undefined &&
          clause?.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) &&
          allTypes(clause.namedBindings.elements));
      add(node, literal(node.moduleSpecifier), typeOnly ? "type" : "static");
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      const typeOnly =
        node.isTypeOnly ||
        (node.exportClause !== undefined &&
          ts.isNamedExports(node.exportClause) &&
          allTypes(node.exportClause.elements));
      add(node, literal(node.moduleSpecifier), typeOnly ? "type" : "static");
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, literal(node.moduleReference.expression), node.isTypeOnly ? "type" : "require");
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      add(node, ts.isLiteralTypeNode(argument) ? literal(argument.literal) : undefined, "type");
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword)
        add(node, literal(node.arguments[0]), "dynamic");
      else if (ts.isIdentifier(callee) && callee.text === "require") {
        add(node, literal(node.arguments[0]), "require");
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text.startsWith("glob") &&
        ts.isMetaProperty(callee.expression)
      ) {
        add(node, literal(node.arguments[0]), "dynamic", true);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const CSS_IMPORTS = new Set(["import", "reference", "plugin", "config"]);

/** The files a stylesheet loads: `@import`, `@reference`, `@plugin` and `@config`. */
function cssImports(path: string, text: string): Written[] {
  return parseCss(text)
    .statements.filter((statement) => CSS_IMPORTS.has(statement.name))
    .map((statement) => ({
      from: path,
      specifier: importedPath(statement.prelude),
      kind: "css" as const,
      line: statement.line,
    }));
}

const SCRIPT = /\.(tsx?|[cm]?jsx?)$/;

/** A file's imports, resolved. */
export function importsOf(path: string, files: Files, cache: ts.ModuleResolutionCache): Import[] {
  const text = files.text(path);
  if (text === undefined) return [];
  const written = path.endsWith(".css")
    ? cssImports(path, text)
    : SCRIPT.test(path)
      ? scriptImports(path, text)
      : [];
  return written.map((entry) => ({
    ...entry,
    ...(entry.specifier === undefined || entry.glob === true
      ? { file: undefined, pkg: undefined, resolved: false }
      : resolveSpecifier(entry.specifier, path, files, cache)),
  }));
}

export function resolutionCache(): ts.ModuleResolutionCache {
  return ts.createModuleResolutionCache(PACKAGE_ROOT, (name) => name, OPTIONS);
}

/** Whether `path` is a file of this app's `src/` or of upstream's web app: the code a walk follows. */
export const ownOrUpstream = (path: string) =>
  path.startsWith(SRC_DIR + sep) || path.startsWith(UPSTREAM_WEB + sep);

/** Upstream's files are read from disk alone, so one view and one cache serve every walk. */
const upstream = {
  files: filesWith(),
  cache: resolutionCache(),
  imports: new Map<string, Import[]>(),
};

/**
 * The files `roots` load, breadth first, through each import `follow` accepts. This app's files
 * are read through `files`, upstream's from disk once per run. `visit` is told each file's
 * imports as the walk reads them, and the walk stops once `done` holds. Gives back every file
 * reached, and the import that first reached each one past the roots.
 */
export function reach(
  roots: Iterable<string>,
  follow: (entry: Import) => boolean,
  {
    files = filesWith(),
    visit,
    done,
  }: {
    files?: Files;
    visit?: (path: string, imports: readonly Import[]) => void;
    done?: (reached: ReadonlySet<string>) => boolean;
  } = {}
): { reached: Set<string>; reachedBy: Map<string, Import> } {
  const cache = resolutionCache();
  const importsFor = (path: string): Import[] => {
    if (!path.startsWith(UPSTREAM_WEB + sep)) return importsOf(path, files, cache);
    let found = upstream.imports.get(path);
    if (found === undefined) {
      found = importsOf(path, upstream.files, upstream.cache);
      upstream.imports.set(path, found);
    }
    return found;
  };
  const queue = [...roots];
  const reached = new Set(queue);
  const reachedBy = new Map<string, Import>();
  for (let index = 0; index < queue.length && done?.(reached) !== true; index += 1) {
    const path = queue[index] as string;
    const imports = importsFor(path);
    visit?.(path, imports);
    for (const entry of imports) {
      if (entry.file === undefined || reached.has(entry.file) || !follow(entry)) continue;
      reached.add(entry.file);
      reachedBy.set(entry.file, entry);
      queue.push(entry.file);
    }
  }
  return { reached, reachedBy };
}

/** The app's own source: every script and stylesheet under `src/`, by absolute path. */
export function ownFiles(files: readonly SourceFile[]): Map<string, string> {
  return new Map(files.map((file) => [join(PACKAGE_ROOT, file.path), file.text]));
}
