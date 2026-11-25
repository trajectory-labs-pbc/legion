// Writes the root registry.json from this package's sources, so `shadcn add` installs the files
// as they are here.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "bun";
import postcss, { AtRule, type ChildNode, type Root, Rule } from "postcss";
import ts from "typescript";
import manifest from "../package.json";

type CssJson = { [key: string]: string | CssJson };
type RegistryFile = { path: string; type: string; target: string };
type RegistryItem = Record<string, unknown> & { name: string; type: string };

const pkg = join(import.meta.dirname, "..");
const repo = join(pkg, "..", "..");
export const registryPath = join(repo, "registry.json");

// The consumer's own React stays theirs.
const CONSUMER_PROVIDED = new Set(["react", "react-dom"]);
// A block is a component with words of its own: a consumer installs it among its components
// and edits the copy.
const KINDS = {
  ui: { dir: "src/components", ext: ".tsx", type: "registry:ui", item: "registry:ui", at: "ui" },
  blocks: {
    dir: "src/blocks",
    ext: ".tsx",
    type: "registry:component",
    item: "registry:block",
    at: "components",
  },
  lib: { dir: "src/lib", ext: ".ts", type: "registry:lib", item: "registry:lib", at: "lib" },
};
type Kind = keyof typeof KINDS;
const isKind = (value: string | undefined): value is Kind =>
  value !== undefined && Object.hasOwn(KINDS, value);

/** Each peer dependency at another version than the one the package is developed against. */
export function peerVersionProblems(
  peers: Readonly<Record<string, string>>,
  devs: Readonly<Record<string, string>>
): string[] {
  return Object.entries(peers).flatMap(([name, version]) =>
    CONSUMER_PROVIDED.has(name) || devs[name] === version
      ? []
      : [`peerDependencies has ${name}@${version}, devDependencies ${devs[name] ?? "nothing"}`]
  );
}

function toJson(nodes: ChildNode[]): CssJson {
  const out: CssJson = {};
  for (const node of nodes) {
    if (node.type === "decl") out[node.prop] = node.value;
    else if (node.type === "rule") out[node.selector] = toJson(node.nodes);
    else if (node.type === "atrule") {
      out[`@${node.name}${node.params ? ` ${node.params}` : ""}`] = toJson(node.nodes ?? []);
    }
  }
  return out;
}

function variables(rule: Rule): Record<string, string> {
  return Object.fromEntries(
    rule.nodes.flatMap((node) =>
      node.type === "decl" && node.prop.startsWith("--") ? [[node.prop.slice(2), node.value]] : []
    )
  );
}

/** A rule without its variables, which the theme item carries as cssVars. */
const withoutVariables = (rule: Rule): Rule =>
  rule.clone({
    nodes: rule.nodes.filter((node) => node.type !== "decl" || !node.prop.startsWith("--")),
  });

function atRule(css: Root, name: string, params: string): AtRule {
  const found = css.nodes.find(
    (node) => node instanceof AtRule && node.name === name && node.params === params
  );
  if (!(found instanceof AtRule)) throw new Error(`the stylesheet has no @${name} ${params}`);
  return found;
}

function rule(css: Root, selector: string): Rule {
  const found = css.nodes.find((node) => node instanceof Rule && node.selector === selector);
  if (!(found instanceof Rule)) throw new Error(`the stylesheet has no ${selector} rule`);
  return found;
}

// The font items set the fonts, so the theme leaves out the base rules that apply them.
const appliesFont = (node: ChildNode): boolean =>
  node instanceof Rule &&
  node.nodes.some((child) => child instanceof AtRule && /\bfont-/.test(child.params));

// theme.css holds the tokens; globals.css adds the dark variant and the base rules.
const stylesheet = (name: string): Root =>
  postcss.parse(readFileSync(join(pkg, "src/styles", name), "utf8"));

function themeVariable(tokens: Root, name: string): string {
  const found = (atRule(tokens, "theme", "inline").nodes ?? []).find(
    (node) => node.type === "decl" && node.prop === name
  );
  if (found?.type !== "decl") throw new Error(`the theme has no ${name}`);
  return found.value;
}

/** The selector of the base rule that applies `utility`, on one line. */
function baseSelector(css: Root, utility: string): string {
  const found = (atRule(css, "layer", "base").nodes ?? []).find(
    (node) =>
      node instanceof Rule &&
      node.nodes.some((child) => child instanceof AtRule && child.params === utility)
  );
  if (!(found instanceof Rule)) throw new Error(`no base rule applies ${utility}`);
  return found.selectors.join(", ");
}

// The font stacks and the mono selector are the stylesheets' own, so an installed font matches.
const fontItems = (tokens: Root, css: Root): RegistryItem[] => [
  {
    name: "font-geist",
    type: "registry:font",
    title: "Geist",
    dependencies: [
      `@fontsource-variable/geist@${manifest.dependencies["@fontsource-variable/geist"]}`,
    ],
    font: {
      family: themeVariable(tokens, "--font-sans"),
      provider: "google",
      import: "Geist",
      variable: "--font-sans",
      dependency: "@fontsource-variable/geist",
    },
  },
  {
    name: "font-geist-mono",
    type: "registry:font",
    title: "Geist Mono",
    dependencies: [
      `@fontsource-variable/geist-mono@${manifest.dependencies["@fontsource-variable/geist-mono"]}`,
    ],
    font: {
      family: themeVariable(tokens, "--font-mono"),
      provider: "google",
      import: "Geist_Mono",
      variable: "--font-mono",
      selector: baseSelector(css, "font-mono"),
      dependency: "@fontsource-variable/geist-mono",
    },
  },
];

function themeItem(tokens: Root, css: Root): RegistryItem {
  const theme = Object.fromEntries(
    (atRule(tokens, "theme", "inline").nodes ?? []).flatMap((node) =>
      node.type === "decl" && !node.prop.startsWith("--font-")
        ? [[node.prop.slice(2), node.value]]
        : []
    )
  );
  const base = atRule(css, "layer", "base");
  const light = rule(tokens, ":root");
  const dark = rule(tokens, ".dark");
  return {
    name: "theme",
    type: "registry:theme",
    title: "Theme",
    description:
      "Light and dark colours, a focus colour, square corners, and a dark variant that follows the OS setting unless the root has .light, or a .dark class.",
    cssVars: { theme, light: variables(light), dark: variables(dark) },
    css: toJson([
      atRule(css, "custom-variant", "dark"),
      withoutVariables(light),
      withoutVariables(dark),
      atRule(tokens, "media", "(prefers-color-scheme: dark)"),
      base.clone({ nodes: (base.nodes ?? []).filter((node) => !appliesFont(node)) }),
    ]),
  };
}

const sourcePath = (kind: Kind, name: string) => `${KINDS[kind].dir}/${name}${KINDS[kind].ext}`;

/** Every module a source imports: static, side-effect, dynamic and type-only imports. */
const importsOf = (text: string): string[] =>
  ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName);

const readSource = (path: string): string => readFileSync(path, "utf8");

// A component item carries every file it imports, so it installs at the ref it was asked for.
export function componentItem(name: string, read = readSource, entryKind: Kind = "ui") {
  const peers = new Map(Object.entries(manifest.peerDependencies));
  const files: RegistryFile[] = [];
  const packages = new Set<string>();
  const pending: [Kind, string][] = [[entryKind, name]];
  const seen = new Set<string>();
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const [kind, file] = next;
    const path = sourcePath(kind, file);
    if (seen.has(path)) continue;
    seen.add(path);
    files.push({
      path: relative(repo, join(pkg, path)),
      type: KINDS[kind].type,
      target: `@${KINDS[kind].at}/${file}${KINDS[kind].ext}`,
    });
    for (const specifier of importsOf(read(join(pkg, path)))) {
      const [, local, localFile] = specifier.match(/^#registry\/legion\/([^/]+)\/(.+)$/) ?? [];
      if (isKind(local) && localFile !== undefined) {
        pending.push([local, localFile]);
        continue;
      }
      if (local !== undefined) throw new Error(`${path} imports ${specifier}, no registry file`);
      const bare = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : (specifier.split("/")[0] ?? specifier);
      if (CONSUMER_PROVIDED.has(bare)) continue;
      const version = peers.get(bare);
      if (version === undefined) throw new Error(`${path} imports ${bare}, not a peer dependency`);
      packages.add(`${bare}@${version}`);
    }
  }
  // The component's own file first, then the files it imports.
  const entry = relative(repo, join(pkg, sourcePath(entryKind, name)));
  return {
    name,
    type: KINDS[entryKind].item,
    dependencies: [...packages].sort(),
    files: files.sort(
      (a, b) => Number(b.path === entry) - Number(a.path === entry) || a.path.localeCompare(b.path)
    ),
  };
}

export function buildRegistry() {
  const problems = peerVersionProblems(manifest.peerDependencies, manifest.devDependencies);
  if (problems.length > 0) throw new Error(problems.join("\n"));
  const named = (kind: Kind) =>
    readdirSync(join(pkg, KINDS[kind].dir))
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
      .map((file) => file.slice(0, -".tsx".length))
      .sort();
  const tokens = stylesheet("theme.css");
  const css = stylesheet("globals.css");
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "legion",
    homepage: "https://github.com/<owner>/<repo>",
    items: [
      themeItem(tokens, css),
      ...fontItems(tokens, css),
      ...named("ui").map((name) => componentItem(name)),
      ...named("blocks").map((name) => componentItem(name, readSource, "blocks")),
    ],
  };
}

if (import.meta.main) {
  writeFileSync(registryPath, `${JSON.stringify(buildRegistry(), null, 2)}\n`);
  const format = spawnSync(["bunx", "biome", "format", "--write", registryPath], { cwd: pkg });
  if (format.exitCode !== 0) throw new Error(format.stderr.toString());
}
