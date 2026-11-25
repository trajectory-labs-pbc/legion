import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "bun";
import { buildRegistry, componentItem, peerVersionProblems, registryPath } from "./registry";

const validate = (dir: string) => {
  const run = spawnSync(["bunx", "--bun", "shadcn", "registry", "validate", "--cwd", dir], {
    cwd: join(import.meta.dirname, ".."),
  });
  return { exitCode: run.exitCode, output: `${run.stdout}${run.stderr}` };
};

describe("registry.json", () => {
  it("is what scripts/registry.ts writes from the sources and the stylesheet", () => {
    const committed = JSON.parse(readFileSync(registryPath, "utf8"));
    expect(committed, "run `bun run registry` in packages/ui").toEqual(buildRegistry());
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
    const dir = mkdtempSync(join(tmpdir(), "registry-"));
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
