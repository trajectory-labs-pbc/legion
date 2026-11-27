import { describe, expect, it } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryDirectories } from "@legion/test-fixtures/temporary-directories";
import { spawnSync } from "bun";
import postcss from "postcss";
import {
  buildRegistry,
  componentItem,
  peerVersionProblems,
  registryPath,
  toJson,
} from "./registry";

const validate = (dir: string) => {
  const run = spawnSync(["bunx", "--bun", "shadcn", "registry", "validate", "--cwd", dir], {
    cwd: join(import.meta.dirname, ".."),
  });
  return { exitCode: run.exitCode, output: `${run.stdout}${run.stderr}` };
};

describe("registry.json", () => {
  const makeDirectory = temporaryDirectories("registry");

  it("is what scripts/registry.ts writes from the sources and the stylesheet", () => {
    const committed = JSON.parse(readFileSync(registryPath, "utf8"));
    expect(committed, "run `bun run registry` in packages/ui").toEqual(buildRegistry());
  });

  it("installs the theme's base rules beside the stylesheet's, so an icon draws at the theme's stroke", () => {
    const theme = buildRegistry().items.find((item) => item.name === "theme");
    const base = (theme as { css?: Record<string, Record<string, unknown>> } | undefined)?.css?.[
      "@layer base"
    ];
    expect(base?.['svg.lucide[stroke-width="2"]']).toEqual({
      "stroke-width": "var(--icon-stroke)",
    });
    expect(base?.body).toEqual({ "@apply bg-background text-foreground": {} });
  });

  it("installs the theme's utilities, so the type recipes' wrap classes draw", () => {
    const theme = buildRegistry().items.find((item) => item.name === "theme");
    const css = (theme as { css?: Record<string, unknown> } | undefined)?.css;
    expect(css?.["@utility wrap-balance"]).toEqual({ "text-wrap-style": "balance" });
    expect(css?.["@utility wrap-pretty"]).toEqual({ "text-wrap-style": "pretty" });
  });

  it("refuses two rules with one selector, of which the JSON would keep only the last", () => {
    expect(() => toJson(postcss.parse("body { color: red } body { margin: 0 }").nodes)).toThrow(
      "body"
    );
  });

  it("lists a package a component imports for its side effect or loads on demand", () => {
    const item = componentItem("badge", (path) =>
      path.endsWith("badge.tsx") ? 'import "lucide-react";\nconst load = () => import("cn");\n' : ""
    );
    expect(item.dependencies).toEqual(["cn@0.2.6", "lucide-react@1.70.0"]);
  });

  it("refuses a peer dependency at another version than the one the package is tested against", () => {
    expect(peerVersionProblems({ cn: "0.2.6", react: "^19.2.0" }, { cn: "0.2.6" })).toEqual([]);
    expect(peerVersionProblems({ cn: "0.2.7", "lucide-react": "1.70.0" }, { cn: "0.2.6" })).toEqual(
      [
        "peerDependencies has cn@0.2.7, devDependencies 0.2.6",
        "peerDependencies has lucide-react@1.70.0, devDependencies nothing",
      ]
    );
  });

  it("passes shadcn registry validate", () => {
    const run = validate(join(registryPath, ".."));
    expect(run.output).toContain("Registry is valid");
    expect(run.exitCode).toBe(0);
  }, 60_000);

  it("fails shadcn registry validate when an item names a file that is not there", () => {
    const dir = makeDirectory();
    const registry = buildRegistry();
    const broken = {
      ...registry,
      items: [
        {
          name: "broken",
          type: "registry:ui",
          files: [{ path: "absent.tsx", type: "registry:ui" }],
        },
      ],
    };
    writeFileSync(join(dir, "registry.json"), JSON.stringify(broken));
    const run = validate(dir);
    expect(run.output).toContain('"absent.tsx" was not found');
    expect(run.exitCode).toBe(1);
  }, 60_000);
});
