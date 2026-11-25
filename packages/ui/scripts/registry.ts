// Writes the root registry.json from this package's sources, so `shadcn add` installs the files
// as they are here.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "bun";
import postcss, { type ChildNode, type Root } from "postcss";

type CssJson = { [key: string]: string | CssJson };
type RegistryFile = { path: string; type: string; target: string };
type RegistryItem = Record<string, unknown> & { name: string; type: string };

const pkg = join(import.meta.dirname, "..");
const repo = join(pkg, "..", "..");
export const registryPath = join(repo, "registry.json");
const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};

// The consumer's own React stays theirs.
const CONSUMER_PROVIDED = new Set(["react", "react-dom"]);
const KINDS = {
  ui: { dir: "src/components", ext: ".tsx", type: "registry:ui" },
  lib: { dir: "src/lib", ext: ".ts", type: "registry:lib" },
  hooks: { dir: "src/hooks", ext: ".ts", type: "registry:hook" },
} as const;
type Kind = keyof typeof KINDS;

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

function variables(nodes: ChildNode[]): Record<string, string> {
  return Object.fromEntries(
    nodes.flatMap((node) =>
      node.type === "decl" && node.prop.startsWith("--") ? [[node.prop.slice(2), node.value]] : []
    )
  );
}

const atRule = (css: Root, name: string, params: string) => {
  const found = css.nodes.find(
    (node) => node.type === "atrule" && node.name === name && node.params === params
  );
  if (found?.type !== "atrule") throw new Error(`globals.css has no @${name} ${params}`);
  return found;
};
const rule = (css: Root, selector: string) => {
  const found = css.nodes.find((node) => node.type === "rule" && node.selector === selector);
  if (found?.type !== "rule") throw new Error(`globals.css has no ${selector} rule`);
  return found;
};
const appliedFont = (node: ChildNode): string | undefined =>
  node.type === "rule"
    ? node.nodes
        .flatMap((child) =>
          child.type === "atrule" && child.name === "apply" ? [child.params] : []
        )
        .join(" ")
        .match(/\bfont-(sans|serif|mono)\b/)?.[1]
    : undefined;

// The theme and one item per font, all read from the stylesheet.
function themeItems(): RegistryItem[] {
  const css = postcss.parse(readFileSync(join(pkg, "src/styles/globals.css"), "utf8"));
  const theme = variables(atRule(css, "theme", "inline").nodes ?? []);
  const base = atRule(css, "layer", "base");
  const fontRules = (base.nodes ?? []).filter((node) => appliedFont(node) !== undefined);

  const fonts = Object.entries(theme)
    .filter(([name]) => name.startsWith("font-"))
    .map(([name, family]): RegistryItem => {
      const face = family.match(/^"([^"]+) Variable"/)?.[1];
      if (face === undefined) throw new Error(`--${name} does not start with a variable font`);
      const slug = face.toLowerCase().replaceAll(" ", "-");
      const dependency = `@fontsource-variable/${slug}`;
      const version = manifest.dependencies[dependency];
      if (version === undefined) throw new Error(`package.json does not depend on ${dependency}`);
      atRule(css, "import", `"${dependency}"`);
      const selector = fontRules.find((node) => `font-${appliedFont(node)}` === name);
      if (selector?.type !== "rule") throw new Error(`no base rule applies ${name}`);
      return {
        name: `font-${slug}`,
        type: "registry:font",
        title: face,
        dependencies: [`${dependency}@${version}`],
        font: {
          family,
          provider: "google",
          import: face.replaceAll(" ", "_"),
          variable: `--${name}`,
          ...(selector.selector === "html"
            ? {}
            : { selector: selector.selector.replace(/\s+/g, " ") }),
          dependency,
        },
      };
    });

  return [
    {
      name: "theme",
      type: "registry:theme",
      title: "Theme",
      description:
        "Light and dark colours, a focus colour, square corners, and a dark variant that follows the OS setting or a .dark class.",
      cssVars: {
        theme: Object.fromEntries(
          Object.entries(theme).filter(([name]) => !name.startsWith("font-"))
        ),
        light: variables(rule(css, ":root").nodes),
        dark: variables(rule(css, ".dark").nodes),
      },
      css: toJson([
        atRule(css, "custom-variant", "dark"),
        atRule(css, "media", "(prefers-color-scheme: dark)"),
        base.clone({ nodes: (base.nodes ?? []).filter((node) => !fontRules.includes(node)) }),
      ]),
    },
    ...fonts,
  ];
}

const sourcePath = (kind: Kind, name: string) => `${KINDS[kind].dir}/${name}${KINDS[kind].ext}`;

// A component item carries every file it imports, so it installs at the ref it was asked for.
function componentItem(name: string): RegistryItem {
  const files: RegistryFile[] = [];
  const packages = new Set<string>();
  const pending: [Kind, string][] = [["ui", name]];
  const seen = new Set<string>();
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const [kind, file] = next;
    const path = sourcePath(kind, file);
    if (seen.has(path)) continue;
    seen.add(path);
    files.push({
      path: relative(repo, join(pkg, path)),
      type: KINDS[kind].type,
      target: `@${kind}/${file}${KINDS[kind].ext}`,
    });
    for (const [, specifier] of readFileSync(join(pkg, path), "utf8").matchAll(/from "([^"]+)"/g)) {
      if (specifier === undefined) continue;
      const local = specifier.match(/^#registry\/legion\/(ui|lib|hooks)\/(.+)$/);
      if (local?.[1] !== undefined && local[2] !== undefined) {
        pending.push([local[1] as Kind, local[2]]);
        continue;
      }
      const bare = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : (specifier.split("/")[0] ?? specifier);
      if (CONSUMER_PROVIDED.has(bare)) continue;
      const version = manifest.peerDependencies[bare];
      if (version === undefined) throw new Error(`${path} imports ${bare}, not a peer dependency`);
      packages.add(`${bare}@${version}`);
    }
  }
  return {
    name,
    type: "registry:ui",
    dependencies: [...packages].sort(),
    files: [
      files[0] as RegistryFile,
      ...files.slice(1).sort((a, b) => a.path.localeCompare(b.path)),
    ],
  };
}

export function buildRegistry() {
  const components = readdirSync(join(pkg, KINDS.ui.dir))
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .map((file) => file.slice(0, -".tsx".length))
    .sort();
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "legion",
    homepage: "https://github.com/trajectory-labs-pbc/legion",
    items: [...themeItems(), ...components.map(componentItem)],
  };
}

if (import.meta.main) {
  writeFileSync(registryPath, `${JSON.stringify(buildRegistry(), null, 2)}\n`);
  const format = spawnSync(["bunx", "biome", "format", "--write", registryPath], { cwd: pkg });
  if (format.exitCode !== 0) throw new Error(format.stderr.toString());
}
