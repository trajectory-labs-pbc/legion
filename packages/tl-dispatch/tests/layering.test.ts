import { describe, expect, test } from "bun:test";

import { layerViolations } from "./layering";
import { sourceFiles } from "./source";

const rulesOf = (files: { path: string; text: string }[], path = files[0]?.path) =>
  layerViolations(files)
    .filter((violation) => violation.file === path)
    .map((violation) => violation.rule);

describe("layers", () => {
  test("no file of the app crosses a layer", () => {
    expect(layerViolations(sourceFiles())).toEqual([]);
  });

  test.each([
    [
      "src/shell/x.tsx",
      "const app = import(`@upstream-dispatch/app`);",
      "reaches upstream's app.tsx",
    ],
    ["src/shell/x.tsx", 'import "@upstream-dispatch/main";', "reaches upstream's main.tsx"],
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
      "reaches upstream's app.tsx",
    ],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the control is source text that holds a template
    ["src/shell/x.tsx", "const name = 'app'; import(`@upstream-dispatch/${name}`);", "non-literal"],
    ["src/shell/x.tsx", "const pages = import.meta.glob('../pages/*.tsx');", "import.meta.glob"],
    ["src/ui/x.tsx", 'import { appCatalog } from "@/commands/app-catalog";', "resolves to no file"],
    ["src/ui/x.tsx", 'import { appCatalog } from "../commands/app-catalog";', "outside src/ui"],
    [
      "src/ui/x.tsx",
      'import type { KeymapScope } from "@upstream-dispatch/features/shell/keymap";',
      "outside src/ui",
    ],
    ["src/ui/x.tsx", 'import { Link } from "react-router-dom";', "no router"],
    ["src/ui/x.tsx", 'import { useRouter } from "@tanstack/react-router";', "no router"],
    ["src/ui/x.tsx", 'import { useQuery } from "@tanstack/react-query";', "no data"],
    ["src/ui/x.css", '@import "../../../dispatch/web/src/styles.css";', "outside src/ui"],
    ["src/ui/x.css", "/* a note */ @import url('../shell/extra.css');", "resolves to no file"],
    [
      "src/commands/x.ts",
      'import { useNavigate } from "react-router-dom";',
      "never imports navigation",
    ],
    ["src/commands/x.ts", 'import { AppShell } from "../shell/AppShell";', "below the shell"],
  ])("refuses %s: %s", (path, text, rule) => {
    expect(rulesOf([{ path, text }]).join("\n")).toContain(rule);
  });

  test("matches the ui folder by path segment, so src/ui-anything is outside it", () => {
    const files = [
      { path: "src/ui/x.tsx", text: 'import { y } from "../ui-anything/y";' },
      { path: "src/ui-anything/y.ts", text: "export const y = 1;" },
    ];
    expect(rulesOf(files)).toEqual([
      "src/ui holds components only: it imports nothing outside src/ui",
    ]);
  });

  test("reads code, not text: a glob in a string hides no import", () => {
    const text = [
      '<input accept="image/*" />;',
      'import { App } from "@upstream-dispatch/app";',
      "// */",
    ].join("\n");
    expect(rulesOf([{ path: "src/shell/x.tsx", text }]).join()).toContain(
      "reaches upstream's app.tsx"
    );
  });

  test.each([
    ["src/ui/x.tsx", 'import { y } from "./y";', ["src/ui/y.ts", "export const y = 1;"]],
    ["src/ui/x.tsx", 'import { useState } from "react";', undefined],
    [
      "src/shell/x.tsx",
      'import { Sidebar } from "@upstream-dispatch/features/sidebar/Sidebar";',
      undefined,
    ],
    ["src/ui/x.tsx", '// import { App } from "@upstream-dispatch/app";', undefined],
    ["src/ui/x.tsx", "const text = \"import { App } from '@upstream-dispatch/app'\";", undefined],
  ] as const)("allows %s: %s", (path, text, sibling) => {
    const files = [
      { path, text },
      ...(sibling === undefined ? [] : [{ path: sibling[0], text: sibling[1] }]),
    ];
    expect(layerViolations(files)).toEqual([]);
  });
});
