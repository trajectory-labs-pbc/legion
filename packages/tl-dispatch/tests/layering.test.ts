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
    ["src/shell/x.tsx", 'import { y } from "@/nowhere/y";', "resolves to no file"],
    ["src/shell/x.css", "/* a note */ @import url('../pages/extra.css');", "resolves to no file"],
    [
      "src/pages/x.tsx",
      'import { Dialog } from "@base-ui/react/dialog";',
      "Base UI comes through packages/ui",
    ],
    [
      "src/commands/x.ts",
      'import { useNavigate } from "react-router-dom";',
      "never imports navigation",
    ],
    ["src/navigation/x.ts", 'import { inbox } from "@/pages/inbox";', "navigation names no page"],
    ["src/shell/x.tsx", 'import { useNavigate } from "react-router-dom";', "only src/navigation"],
    ["src/pages/x.tsx", 'import { Link } from "react-router";', "only src/navigation"],
    ["src/main.tsx", 'import { BrowserRouter } from "react-router-dom";', "only src/navigation"],
  ])("refuses %s: %s", (path, text, rule) => {
    expect(rulesOf([{ path, text }]).join("\n")).toContain(rule);
  });

  test("matches a folder by path segment, so src/navigation-anything is outside navigation", () => {
    const files = [
      { path: "src/navigation-anything/x.tsx", text: 'import { Link } from "react-router-dom";' },
    ];
    expect(rulesOf(files)).toEqual([
      "only src/navigation imports the router, so a router move changes one folder",
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
    ["src/shell/x.tsx", 'import { y } from "./y";', ["src/shell/y.ts", "export const y = 1;"]],
    ["src/shell/x.tsx", 'import { useState } from "react";', undefined],
    ["src/shell/x.tsx", 'import { Button } from "@legion/ui/components/button";', undefined],
    ["src/navigation/x.tsx", 'import { Link } from "react-router-dom";', undefined],
    [
      "src/shell/x.tsx",
      'import { Sidebar } from "@upstream-dispatch/features/sidebar/Sidebar";',
      undefined,
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
});
