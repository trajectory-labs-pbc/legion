import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { againstBreaks, layerViolations, rulesWithoutHeading, upstreamAppLoads } from "./layering";
import { BREAKS } from "./layers.table";
import { filesUnder, layeringFiles, PACKAGE_ROOT, type SourceFile } from "./source";

/** Each rule the first file breaks, with its detail. */
const rulesOf = (files: SourceFile[]) =>
  layerViolations(files)
    .filter((violation) => violation.file === files[0]?.path)
    .map((violation) => `${violation.rule}: ${violation.detail}`)
    .join("\n");

const file = (path: string, text = "export {};"): SourceFile => ({ path, text });

describe("layers", () => {
  test("each import of the app and its tests that breaks a rule is in today's breaks", () => {
    const { unlisted, stale } = againstBreaks(layerViolations(layeringFiles()), BREAKS);
    expect(unlisted).toEqual([]);
    expect(stale).toEqual([]);
  });

  test("no file of e2e/ or scripts/ loads upstream's app", () => {
    const files = [...filesUnder(PACKAGE_ROOT, "e2e"), ...filesUnder(PACKAGE_ROOT, "scripts")];
    expect(upstreamAppLoads(files)).toEqual([]);
    const door = file("e2e/door.ts", 'export { App } from "@upstream-dispatch/app";');
    expect(upstreamAppLoads([door]).map((violation) => violation.file)).toEqual(["e2e/door.ts"]);
  });

  test("today's breaks match each import once: an entry that breaks no rule fails", () => {
    const shell = file("src/shell/x.tsx", 'import "@/pages/inbox";');
    const found = layerViolations([shell]);
    const listed = { "imports-only-above": { "src/shell/x.tsx": ["@/pages/inbox"] } };
    expect(againstBreaks(found, listed)).toEqual({ unlisted: [], stale: [] });
    const twice = {
      "imports-only-above": { "src/shell/x.tsx": ["@/pages/inbox", "@/pages/inbox"] },
    };
    expect(againstBreaks(found, twice).stale).toEqual([
      "imports-only-above src/shell/x.tsx @/pages/inbox",
    ]);
    expect(againstBreaks([...found, ...found], listed).unlisted).toHaveLength(1);
    expect(againstBreaks([...found, ...found, ...found], listed).unlisted).toHaveLength(2);
    expect(againstBreaks([...found, ...found], {}).unlisted).toHaveLength(2);
  });

  test("tests/layers.md has a heading for each rule of the table", () => {
    const markdown = readFileSync(join(PACKAGE_ROOT, "tests/layers.md"), "utf8");
    expect(rulesWithoutHeading(markdown)).toEqual([]);
    const without = markdown.replace(/^## .*`no-cycles`.*$/m, "## Cycles");
    expect(rulesWithoutHeading(without)).toEqual(["no-cycles"]);
  });

  test.each([
    [
      "src/shell/x.tsx",
      "const app = import(`@upstream-dispatch/app`);",
      "upstream-app-never-loads",
    ],
    ["src/shell/x.tsx", 'import "@upstream-dispatch/main";', "reaches upstream's main.tsx"],
    [
      "src/shell/x.tsx",
      'import { App } from "@upstream-dispatch/app";',
      "reaches upstream's app.tsx",
    ],
    [
      "src/pages/x.tsx",
      'import { fixture } from "@upstream-dispatch/app-sign-out-fixture";',
      "app-sign-out-fixture.tsx > ../dispatch/web/src/app.tsx",
    ],
    [
      "src/shell/x.tsx",
      'export * from "../../../dispatch/web/src/app";',
      "reaches upstream's app.tsx",
    ],
    [
      "src/shell/x.jsx",
      'const app = require("@upstream-dispatch/app");',
      "upstream-app-never-loads",
    ],
    [
      "src/shell/x.test.tsx",
      'import { App } from "@upstream-dispatch/app";',
      "upstream-app-never-loads",
    ],
    [
      "tests/upstream.ts",
      'export { App } from "@upstream-dispatch/app";',
      "upstream-app-never-loads",
    ],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the control is source text that holds a template
    ["src/shell/x.tsx", "const name = 'app'; import(`@upstream-dispatch/${name}`);", "non-literal"],
    ["src/shell/x.tsx", "const pages = import.meta.glob('../pages/*.tsx');", "import.meta.glob"],
    ["src/shell/x.tsx", 'import { y } from "@/nowhere/y";', "resolves to no file"],
    ["src/shell/x.css", "/* a note */ @import url('../pages/extra.css');", "resolves to no file"],
    [
      "src/shell/x.tsx",
      'import { y } from "@upstream-dispatch/api/client";',
      "only-the-seam-imports-upstream",
    ],
    [
      "src/features/x/route.tsx",
      'import { y } from "@upstream-dispatch/api/client";',
      "only-the-seam",
    ],
    [
      "src/shell/x.tsx",
      'import type { Y } from "@legion/contracts";',
      "only-the-seam-imports-upstream",
    ],
    [
      "src/shell/x.test.tsx",
      'import { y } from "@upstream-dispatch/__tests__/fake-clock";',
      "only-the-seam",
    ],
    [
      "tests/x.ts",
      'import { y } from "@upstream-dispatch/api/client";',
      "only-the-seam-imports-upstream",
    ],
    ["src/pages/x.tsx", 'import { Dialog } from "@base-ui/react/dialog";', "Base UI comes through"],
    [
      "src/shell/x.test.tsx",
      'import { Dialog } from "@base-ui/react/dialog";',
      "Base UI comes through",
    ],
    [
      "src/features/inbox/x.tsx",
      'import { useQuery } from "@tanstack/react-query";',
      "library-owners",
    ],
    ["src/shell/x.tsx", 'import { useNavigate } from "react-router-dom";', "only src/navigation"],
    ["src/pages/x.tsx", 'import { Link } from "react-router";', "only src/navigation"],
    ["src/main.tsx", 'import { BrowserRouter } from "react-router-dom";', "only src/navigation"],
    [
      "src/commands/x.ts",
      'import { AppShell } from "../shell/app-shell";',
      "commands is above shell",
    ],
    ["src/commands/x.ts", 'import { useGoTo } from "@/navigation/hooks";', "one-row"],
    ["src/navigation/x.ts", 'import { bindings } from "@/commands/bindings";', "one-row"],
    ["src/navigation/x.ts", 'import { inbox } from "@/pages/inbox";', "navigation is above routes"],
    [
      "src/navigation/x.ts",
      'import type { ShellLayout } from "../shell/use-shell-layout";',
      "navigation is above shell",
    ],
    [
      "src/shell/x.tsx",
      'import { renderApp } from "../../tests/react";',
      "only a test imports tests/react.ts",
    ],
    [
      "src/shell/x.tsx",
      'import config from "../../vite.config";',
      "only a test imports vite.config.ts",
    ],
    ["src/shell/x.test.tsx", 'import "../main";', "src/main.tsx is read by no file"],
    ["tests/x.ts", 'import "../src/views";', "src/views.ts is read by tests/map"],
  ])("refuses %s: %s", (path, text, rule) => {
    expect(rulesOf([{ path, text }])).toContain(rule);
  });

  test("a page imports no route file: the route file is below the features", () => {
    const page = file("src/features/inbox/page.tsx", 'import { route } from "./route";');
    expect(rulesOf([page, file("src/features/inbox/route.tsx")])).toContain(
      "features is above routes"
    );
  });

  test.each([
    "src/widgets/x.tsx",
    "src/widgets/x.test.tsx",
    "src/features/loose.tsx",
    "src/parts/x.tsx",
  ])("a file in no row has no layer: %s", (path) => {
    expect(rulesOf([file(path)])).toContain("every-file-has-a-layer");
  });

  test("matches a folder by path segment, so src/navigation-anything is outside navigation", () => {
    const rules = rulesOf([
      file("src/navigation-anything/x.tsx", 'import { Link } from "react-router-dom";'),
    ]);
    expect(rules).toContain("every-file-has-a-layer");
    expect(rules).toContain("library-owners");
  });

  test("a seam file has only its readers", () => {
    const api = file("src/upstream/api.ts");
    const reader = (path: string) => rulesOf([file(path, 'import "@/upstream/api";'), api]);
    expect(reader("src/features/x/route.tsx")).toContain("seam-readers");
    expect(reader("src/shell/x.tsx")).toContain("seam-readers");
    expect(reader("src/data/x.ts")).toBe("");
    expect(reader("src/app/providers.tsx")).toBe("");
    expect(reader("src/shell/x.test.tsx")).toBe("");
    const unlisted = [
      file("src/data/x.ts", 'import "@/upstream/other";'),
      file("src/upstream/other.ts"),
    ];
    expect(rulesOf(unlisted)).toContain("is read by no file");
  });

  test("a page's view file is read by that page alone", () => {
    const view = (path: string, target: string) =>
      rulesOf([
        file(path, `import("@/upstream/views/${target}");`),
        file(`src/upstream/views/${target}.tsx`),
      ]);
    expect(view("src/features/inbox/route.tsx", "inbox")).toBe("");
    expect(view("src/features/inbox/page.tsx", "inbox")).toBe("");
    expect(view("src/pages/inbox.tsx", "inbox")).toBe("");
    expect(view("src/features/agents/route.tsx", "inbox")).toContain("seam-readers");
    expect(view("src/features/agents/x.tsx", "inbox")).toContain("seam-readers");
    const folder = [
      file("src/features/inbox/page.tsx", 'import "@/upstream/views/inbox/list";'),
      file("src/upstream/views/inbox/list.tsx"),
    ];
    expect(rulesOf(folder)).toBe("");
  });

  test("a feature or a part is imported only through its index, from any layer", () => {
    const inner = (path: string, target: string) =>
      rulesOf([file(path, `import "@/${target}/row";`), file(`src/${target}/row.tsx`)]);
    expect(inner("src/features/inbox/x.tsx", "features/agents")).toContain("through-the-index");
    expect(inner("src/parts/a/x.tsx", "parts/b")).toContain("through-the-index");
    expect(inner("src/features/inbox/x.tsx", "parts/b")).toContain("through-the-index");
    expect(inner("src/shell/x.tsx", "features/agents")).toContain("through-the-index");
    expect(inner("src/features/agents/route.tsx", "features/agents")).toBe("");
  });

  test("the imports between features, and between parts, make no cycle", () => {
    const ring = (layer: string, names: string[]) =>
      names.flatMap((name, at) => [
        file(
          `src/${layer}/${name}/x.tsx`,
          `import "@/${layer}/${names[(at + 1) % names.length]}/index";`
        ),
        file(`src/${layer}/${name}/index.ts`),
      ]);
    const cyclesOf = (files: SourceFile[]) =>
      layerViolations(files)
        .filter((violation) => violation.rule === "no-cycles")
        .map((violation) => violation.detail);
    expect(cyclesOf(ring("features", ["a", "b"]))).toEqual(["src/features/a, src/features/b"]);
    expect(cyclesOf(ring("features", ["a", "b", "c"]))).toEqual([
      "src/features/a, src/features/b, src/features/c",
    ]);
    expect(cyclesOf(ring("parts", ["a", "b"]))).toEqual(["src/parts/a, src/parts/b"]);
    const chain = [...ring("features", ["a", "b"]).slice(0, 2), file("src/features/b/index.ts")];
    expect(cyclesOf(chain)).toEqual([]);
  });

  test("a feature or a part does not import its own index, and only its root has one", () => {
    const index = file("src/features/inbox/index.ts");
    const own = (text: string) => rulesOf([file("src/features/inbox/list/row.tsx", text), index]);
    expect(own('import "@/features/inbox/index";')).toContain("no-own-index");
    expect(own('import "../index";')).toContain("no-own-index");
    expect(
      rulesOf([file("src/parts/asks/x.tsx", 'import "./index";'), file("src/parts/asks/index.ts")])
    ).toContain("no-own-index");
    expect(rulesOf([file("src/features/inbox/list/index.ts")])).toContain("index-only-at-the-root");
    expect(rulesOf([file("src/features/index.ts")])).toContain("every-file-has-a-layer");
  });

  test("reads code, not text: a glob in a string hides no import", () => {
    const text = [
      '<input accept="image/*" />;',
      'import { App } from "@upstream-dispatch/app";',
      "// */",
    ].join("\n");
    expect(rulesOf([{ path: "src/shell/x.tsx", text }])).toContain("reaches upstream's app.tsx");
  });

  test.each([
    ["src/shell/x.tsx", 'import { y } from "./y";', ["src/shell/y.ts", "export const y = 1;"]],
    ["src/shell/x.tsx", 'import { useState } from "react";', undefined],
    ["src/shell/x.tsx", 'import { Button } from "@legion/ui/components/button";', undefined],
    ["src/shell/x.tsx", 'import { NeedsYouMark } from "@/features/needs-you";', undefined],
    ["src/pages/x.tsx", 'import { AppShell } from "@/shell/app-shell";', undefined],
    ["src/commands/x.ts", 'import { lazyNamed } from "@/loading/lazy-named";', undefined],
    ["src/navigation/x.tsx", 'import { Link } from "react-router-dom";', undefined],
    ["src/data/x.ts", 'import { useQuery } from "@tanstack/react-query";', undefined],
    ["src/shell/x.test.tsx", 'import { QueryClient } from "@tanstack/react-query";', undefined],
    ["src/shell/x.test.tsx", 'import { MemoryRouter } from "react-router-dom";', undefined],
    ["src/shell/x.test.tsx", 'import { renderApp } from "../../tests/react";', undefined],
    ["tests/x.ts", 'import { AppShell } from "@/shell/app-shell";', undefined],
    [
      "tests/x.ts",
      'import { y } from "./upstream";',
      ["tests/upstream.ts", 'export { y } from "@upstream-dispatch/api/client";'],
    ],
    ["src/shell/x.tsx", '// import { App } from "@upstream-dispatch/app";', undefined],
    [
      "src/shell/x.tsx",
      "const text = \"import { App } from '@upstream-dispatch/app'\";",
      undefined,
    ],
  ] as const)("allows %s: %s", (path, text, sibling) => {
    const files = [
      { path, text },
      ...(sibling === undefined ? [] : [{ path: sibling[0], text: sibling[1] }]),
    ];
    expect(layerViolations(files)).toEqual([]);
  });

  test("a type-only import loads nothing, so it never reaches upstream's app", () => {
    for (const text of [
      'import { type App } from "@upstream-dispatch/app";',
      'export { type App } from "@upstream-dispatch/app";',
    ]) {
      expect(layerViolations([{ path: "src/upstream/x.ts", text }])).toEqual([]);
    }
  });

  // Either flag keeps `import { type App } from "..."` in the build as a bare import, which runs
  // the module, so the type-only allowance above would let upstream's app in.
  test("the build drops type-only imports: tsconfig sets no flag that keeps them", () => {
    const { compilerOptions } = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "tsconfig.json"), "utf8")
    ) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(compilerOptions.verbatimModuleSyntax ?? false).toBe(false);
    expect(compilerOptions.preserveValueImports ?? false).toBe(false);
  });
});
