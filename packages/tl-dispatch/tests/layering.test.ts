import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  againstBreaks,
  eagerProblems,
  layerViolations,
  rulesWithoutHeading,
  unmarkedExports,
  upstreamAppLoads,
} from "./layering";
import { BREAKS, EAGER } from "./layers.table";
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

  test("each page EAGER names exists and its route imports it statically, with a reason", () => {
    expect(eagerProblems(layeringFiles(), EAGER)).toEqual([]);
  });

  test("an EAGER entry fails without a file, a reason or its route's static import", () => {
    const page = file("src/features/x/page.tsx", 'import { View } from "@/upstream/views/x";');
    const view = file("src/upstream/views/x.tsx", "export const View = () => null;");
    const route = (text: string) => file("src/features/x/route.tsx", text);
    const staticRoute = route('import { X } from "./page";');
    const eager = { "src/features/x/page.tsx": "a reason", "src/upstream/views/x.tsx": "a reason" };
    expect(eagerProblems([page, view, staticRoute], eager)).toEqual([]);
    expect(eagerProblems([page, view, route('const x = import("./page");')], eager)).toEqual([
      "src/features/x/page.tsx: its route does not import it statically",
    ]);
    expect(eagerProblems([page, staticRoute], eager)).toEqual([
      "src/upstream/views/x.tsx: no such file",
      "src/upstream/views/x.tsx: no eager page imports it statically",
    ]);
    expect(
      eagerProblems([page, view, staticRoute], { ...eager, "src/upstream/views/x.tsx": " " })
    ).toEqual(["src/upstream/views/x.tsx: no reason"]);
    expect(eagerProblems([file("src/shell/x.tsx")], { "src/shell/x.tsx": "a reason" })).toEqual([
      "src/shell/x.tsx: neither a feature's file nor an upstream view",
    ]);
  });

  test("an EAGER view or feature file fails when no eager page imports it statically", () => {
    const page = (text: string) => file("src/features/x/page.tsx", text);
    const route = file("src/features/x/route.tsx", 'import { X } from "./page";');
    const parts = [
      file("src/upstream/views/x.tsx", "export const View = () => null;"),
      file("src/features/x/part.tsx", "export const Part = () => null;"),
    ];
    const eager = {
      "src/features/x/page.tsx": "a reason",
      "src/upstream/views/x.tsx": "a reason",
      "src/features/x/part.tsx": "a reason",
    };
    const both = 'import { View } from "@/upstream/views/x";\nimport { Part } from "./part";';
    expect(eagerProblems([page(both), route, ...parts], eager)).toEqual([]);
    const lazy = 'const view = import("@/upstream/views/x");\nconst part = import("./part");';
    expect(eagerProblems([page(lazy), route, ...parts], eager)).toEqual([
      "src/upstream/views/x.tsx: no eager page imports it statically",
      "src/features/x/part.tsx: no eager page imports it statically",
    ]);
  });

  test("today's breaks match each import once: an entry that breaks no rule fails", () => {
    const shell = file("src/shell/x.tsx", 'import "@/app/routes";');
    const found = layerViolations([shell]);
    const listed = { "imports-only-above": { "src/shell/x.tsx": ["@/app/routes"] } };
    expect(againstBreaks(found, listed)).toEqual({ unlisted: [], stale: [] });
    const twice = {
      "imports-only-above": { "src/shell/x.tsx": ["@/app/routes", "@/app/routes"] },
    };
    expect(againstBreaks(found, twice).stale).toEqual([
      "imports-only-above src/shell/x.tsx @/app/routes",
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
      "src/features/x/route.tsx",
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
    [
      "src/features/x/route.tsx",
      'import { Dialog } from "@base-ui/react/dialog";',
      "Base UI comes through",
    ],
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
    ["src/shell/x.tsx", 'import { create } from "zustand";', "src/stores"],
    ["src/shell/x.test.tsx", 'import { persist } from "zustand/middleware";', "src/stores"],
    ["src/shell/x.tsx", 'import { useNavigate } from "react-router-dom";', "only src/navigation"],
    ["src/features/x/route.tsx", 'import { Link } from "react-router";', "only src/navigation"],
    ["src/main.tsx", 'import { BrowserRouter } from "react-router-dom";', "only src/navigation"],
    ["src/shell/x.tsx", 'import { useLocation } from "react-router-dom";', "and src/app import"],
    ["src/shell/x.tsx", 'import { AppProviders } from "@/app/providers";', "shell is above app"],
    ["src/features/inbox/x.tsx", 'import { pages } from "@/app/routes";', "features is above app"],
    [
      "src/commands/x.ts",
      'import { AppShell } from "../shell/app-shell";',
      "commands is above shell",
    ],
    ["src/commands/x.ts", 'import { useGoTo } from "@/navigation/hooks";', "one-row"],
    ["src/navigation/x.ts", 'import { bindings } from "@/commands/bindings";', "one-row"],
    ["src/upstream/x.ts", 'import { useFolded } from "@/stores/sidebar-folds";', "one-row"],
    ["src/stores/x.ts", 'import { api } from "@/upstream/api";', "one-row"],
    ["src/stores/x.ts", 'import { useRead } from "@/data/read";', "stores is above data"],
    [
      "src/navigation/x.ts",
      'import { inbox } from "@/features/inbox/route";',
      "navigation is above routes",
    ],
    [
      "src/shell/x.tsx",
      'import { inbox } from "@/features/inbox/route";',
      "only-the-app-imports-routes",
    ],
    [
      "src/features/agents/route.tsx",
      'import { inbox } from "@/features/inbox/route";',
      "only-the-app-imports-routes",
    ],
    [
      "src/features/agents/route.tsx",
      'const page = import("@/features/inbox/page");',
      "pages-load-lazily",
    ],
    ["src/shell/x.tsx", 'const page = import("@/features/inbox/page");', "pages-load-lazily"],
    [
      "src/features/agents/route.tsx",
      'import { AgentsPage } from "@/upstream/views/agents/agents";',
      "a route file loads an upstream view with import()",
    ],
    [
      "src/features/x/route.tsx",
      'import { Button } from "@legion/ui/components/button";',
      "routes-draw-nothing",
    ],
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
    ["src/shell/x.test.tsx", 'import "../main";', "src/main.tsx is read by tests/main.test.tsx"],
    [
      "src/views.ts",
      'import { pages } from "@/app/routes";',
      "src/app/routes.ts is read by src/main.tsx",
    ],
    ["tests/x.ts", 'import "../src/views";', "src/views.ts is read by tests/map"],
  ])("refuses %s: %s", (path, text, rule) => {
    expect(rulesOf([{ path, text }])).toContain(rule);
  });

  test("a route imports its page statically only when EAGER names the page", () => {
    const route = file("src/features/agents/route.tsx", 'import { AgentsPage } from "./page";');
    expect(rulesOf([route, file("src/features/agents/page.tsx")])).toContain(
      "pages-load-lazily: only src/features/agents/route.tsx imports it, with import()"
    );
  });

  const VIEW = file("src/features/x/view.tsx", "export const View = () => null;");
  test.each([
    ["draws an element", "export const x = <div />;", [], "draws no <div>"],
    ["imports its folder's view", 'import { View } from "./view";', [VIEW], "src/features/x/view"],
    [
      "imports a part",
      'import { NeedsYouMark } from "@/parts/needs-you";',
      [],
      "src/parts/needs-you/index.ts",
    ],
    ["imports an icon", 'import { BotIcon } from "lucide-react";', [], "no lucide-react"],
    [
      "imports a feature whose index gives a view",
      'import { View } from "@/features/y";',
      [
        file("src/features/y/index.ts", 'export { View } from "./view";'),
        file("src/features/y/view.tsx", "export const View = () => null;"),
      ],
      "src/features/y/index.ts",
    ],
  ])("a route file that %s draws: routes-draw-nothing", (_, text, siblings, detail) => {
    const rules = rulesOf([file("src/features/x/route.tsx", text), ...siblings]);
    expect(rules).toContain(`routes-draw-nothing: a route file `);
    expect(rules).toContain(detail);
  });

  test.each([
    [
      "src/features/not-found/route.tsx",
      'import { NotFound } from "./not-found";',
      "not-found.tsx",
    ],
    [
      "src/features/machine-login/route.tsx",
      'import { MachineLoginPage } from "./machine-login-page";',
      "src/features/machine-login/machine-login-page.tsx",
    ],
    [
      "src/features/issue/route.tsx",
      'import { NotFound } from "@/features/not-found";',
      "src/features/not-found/index.ts",
    ],
  ])("refuses %s: %s, a file of a feature but an eager page", (path, text, detail) => {
    expect(rulesOf([{ path, text }])).toContain(`routes-draw-nothing: a route file imports no `);
    expect(rulesOf([{ path, text }])).toContain(detail);
  });

  test("a type-only import is no load: a route may import its page's and a part's types", () => {
    const route = file(
      "src/features/agents/route.tsx",
      'import type { AgentsPage } from "./page";\nimport type { BotIcon } from "lucide-react";'
    );
    expect(layerViolations([route, file("src/features/agents/page.tsx")])).toEqual([]);
  });

  test("a route.ts and a page.ts are a route file and a page", () => {
    const route = file("src/features/agents/route.ts", "export const agents = {};");
    expect(
      rulesOf([file("src/shell/x.tsx", 'import { agents } from "@/features/agents/route";'), route])
    ).toContain("only-the-app-imports-routes");
    const page = file("src/features/agents/page.ts", "export const AgentsPage = () => null;");
    const eager = file("src/features/agents/route.tsx", 'import { AgentsPage } from "./page";');
    expect(rulesOf([eager, page])).toContain("pages-load-lazily");
    const lazy = file("src/features/agents/route.ts", 'const page = import("./page");');
    expect(layerViolations([lazy, page])).toEqual([]);
  });

  test("a page imports no route file: the route file is below the features", () => {
    const page = file("src/features/inbox/page.tsx", 'import { route } from "./route";');
    const rules = rulesOf([page, file("src/features/inbox/route.tsx")]);
    expect(rules).toContain("features is above routes");
    expect(rules).toContain("only-the-app-imports-routes");
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

  test("the storage file reads neither the data layer nor the seam: browser is above both", () => {
    const storage = (target: string, targetFile: SourceFile) =>
      rulesOf([file("src/browser/storage.ts", `import "${target}";`), targetFile]);
    expect(storage("@/data/read", file("src/data/read.ts"))).toContain(
      "imports-only-above: browser is above data"
    );
    const seam = storage("@/upstream/api", file("src/upstream/api.ts"));
    expect(seam).toContain("seam-readers");
    expect(seam).toContain("imports-only-above: browser is above upstream");
  });

  test("a page's view file is read by that page alone", () => {
    const view = (path: string, target: string) =>
      rulesOf([
        file(path, `import("@/upstream/views/${target}");`),
        file(`src/upstream/views/${target}.tsx`),
      ]);
    expect(view("src/features/inbox/route.tsx", "inbox")).toBe("");
    expect(view("src/features/inbox/page.tsx", "inbox")).toBe("");
    expect(view("src/features/agents/route.tsx", "inbox")).toContain("seam-readers");
    expect(view("src/features/agents/x.tsx", "inbox")).toContain("seam-readers");
    const folder = [
      file("src/features/inbox/page.tsx", 'import "@/upstream/views/inbox/list";'),
      file("src/upstream/views/inbox/list.tsx"),
    ];
    expect(rulesOf(folder)).toBe("");
    const inFolder = (path: string) =>
      rulesOf([
        file(path, 'import("@/upstream/views/agents/broadcasts");'),
        file("src/upstream/views/agents/broadcasts.tsx"),
      ]);
    expect(inFolder("src/features/agents/route.tsx")).toBe("");
    expect(inFolder("src/features/inbox/route.tsx")).toContain("seam-readers");
  });

  test("the mark is read by the seam and by the layers that pass fork elements into it", () => {
    const mark = file("src/upstream/mark.tsx");
    const reader = (path: string) => rulesOf([file(path, 'import "@/upstream/mark";'), mark]);
    expect(reader("src/upstream/widgets/x.tsx")).toBe("");
    expect(reader("src/shell/x.tsx")).toBe("");
    expect(reader("src/loading/x.tsx")).toBe("");
    expect(reader("src/features/inbox/x.tsx")).toBe("");
    expect(reader("src/navigation/x.tsx")).toContain("seam-readers");
    expect(reader("src/data/x.ts")).toContain("seam-readers");
  });

  test("a view or a widget gives each component inside the mark", () => {
    const widget = (text: string, path = "src/upstream/widgets/x.tsx") =>
      unmarkedExports({ path, text }).map((violation) => violation.specifier);
    const marked = [
      'import { X as UpstreamX } from "@upstream-dispatch/features/x/X";',
      'import { upstreamView } from "@/upstream/mark";',
      "export const X = upstreamView(UpstreamX);",
    ].join("\n");
    expect(widget(marked)).toEqual([]);
    expect(widget(marked, "src/upstream/views/agents/x.tsx")).toEqual([]);
    const unwrapped = 'export { X } from "@upstream-dispatch/features/x/X";';
    expect(widget(unwrapped, "src/upstream/views/agents/x.tsx")).toEqual(["X"]);
    expect(widget(unwrapped)).toEqual(["X"]);
    expect(widget("export function X() { return null; }")).toEqual(["X"]);
    expect(widget("export class ErrorBoundary extends Component {}")).toEqual(["ErrorBoundary"]);
    expect(widget("export const X = memo(UpstreamX);")).toEqual(["X"]);
    expect(widget('export * from "@upstream-dispatch/features/x/X";')).toEqual(["*"]);
    expect(widget('export * as X from "@upstream-dispatch/features/x/X";')).toEqual(["*"]);
    expect(widget("export default UpstreamX;")).toEqual(["default"]);
    expect(widget("export namespace Inbox {}")).toEqual(["Inbox"]);
    // A hook, a provider and a type draw nothing in place.
    const passes = [
      'export { useX, XProvider } from "@upstream-dispatch/features/x/X";',
      'export { type XProps } from "@upstream-dispatch/features/x/X";',
      'export type { XState } from "@upstream-dispatch/features/x/X";',
      "export type XView = string;",
      "export interface XRow { id: string }",
    ].join("\n");
    expect(widget(passes)).toEqual([]);
    // Only the mark's upstreamView, in a const, of a component imported from upstream.
    const upstreamX = 'import { X as UpstreamX } from "@upstream-dispatch/features/x/X";';
    const mark = (from: string) => `import { upstreamView } from "${from}";`;
    const wrap = "export const X = upstreamView(UpstreamX);";
    const of = (...lines: string[]) => widget(lines.join("\n"));
    expect(of(upstreamX, mark("../mark"), wrap)).toEqual([]);
    expect(of(upstreamX, "const upstreamView = <T,>(c: T) => c;", wrap)).toEqual(["X"]);
    expect(of(upstreamX, mark("./not-the-mark"), wrap)).toEqual(["X"]);
    expect(of(upstreamX, mark("@/upstream/mark"), wrap.replace("const", "let"))).toEqual(["X"]);
    const destructured = wrap.replace("const X", "const { X }");
    expect(of(upstreamX, mark("@/upstream/mark"), destructured)).toEqual(["{ X }"]);
    const fork = "function Fork() { return null; }";
    expect(of(mark("@/upstream/mark"), fork, wrap.replace("UpstreamX", "Fork"))).toEqual(["X"]);
    // The shell file and a test are not read.
    expect(widget("export function X() {}", "src/upstream/shell.tsx")).toEqual([]);
    expect(widget("export function X() {}", "src/upstream/widgets/x.test.tsx")).toEqual([]);
  });

  test("a view or a widget gives unmarked only the names the table lists", () => {
    const context = 'export { XContext } from "@upstream-dispatch/features/x/context";';
    const row = 'export { XRow } from "@upstream-dispatch/features/x/XRow";';
    const listed = { XContext: "a context draws nothing", XRow: "draws a table row" };
    const of = (text: string, unmarked: Record<string, string>) =>
      unmarkedExports({ path: "src/upstream/widgets/x.tsx", text }, unmarked).length;
    expect(of(context, listed)).toBe(0);
    expect(of(context, {})).toBe(1);
    expect(of(row, listed)).toBe(0);
    expect(rulesOf([file("src/upstream/widgets/x.tsx", row)])).toContain("views-are-marked");
  });

  test("a feature or a part is imported only through its index, from any layer", () => {
    const inner = (path: string, target: string) =>
      rulesOf([file(path, `import "@/${target}/row";`), file(`src/${target}/row.tsx`)]);
    expect(inner("src/features/inbox/x.tsx", "features/agents")).toContain("through-the-index");
    expect(inner("src/parts/a/x.tsx", "parts/b")).toContain("through-the-index");
    expect(inner("src/features/inbox/x.tsx", "parts/b")).toContain("through-the-index");
    expect(inner("src/shell/x.tsx", "features/agents")).toContain("through-the-index");
    expect(inner("src/features/agents/x.tsx", "features/agents")).toBe("");
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
    ["src/shell/x.tsx", 'import { NeedsYouMark } from "@/parts/needs-you";', undefined],
    [
      "src/features/x/route.tsx",
      'import type { PageLayout } from "@/shell/page-layout";',
      undefined,
    ],
    ["src/features/inbox/route.tsx", 'const page = import("./page");', undefined],
    // The home page loads before first paint (EAGER).
    ["src/features/inbox/route.tsx", 'import { InboxPage } from "./page";', undefined],
    ["src/app/x.ts", 'import { inbox } from "@/features/inbox/route";', undefined],
    ["src/features/inbox/page.test.tsx", 'import { InboxPage } from "./page";', undefined],
    ["src/commands/x.ts", 'import { lazyNamed } from "@/loading/lazy-named";', undefined],
    ["src/navigation/x.tsx", 'import { Link } from "react-router-dom";', undefined],
    ["src/app/x.tsx", 'import { BrowserRouter } from "react-router-dom";', undefined],
    ["src/data/x.ts", 'import { useQuery } from "@tanstack/react-query";', undefined],
    ["src/stores/x.ts", 'import { persist } from "zustand/middleware";', undefined],
    ["src/stores/x.ts", 'import { quietly } from "@/browser/storage";', undefined],
    ["src/data/x.ts", 'import { useFolded } from "@/stores/sidebar-folds";', undefined],
    ["src/shell/x.test.tsx", 'import { QueryClient } from "@tanstack/react-query";', undefined],
    ["src/shell/x.test.tsx", 'import { MemoryRouter } from "react-router-dom";', undefined],
    ["src/shell/x.test.tsx", 'import { renderApp } from "../../tests/react";', undefined],
    ["tests/x.ts", 'import { AppShell } from "@/shell/app-shell";', undefined],
    ["tests/main.test.tsx", 'await import("../src/main");', undefined],
    ["src/main.tsx", 'import { start } from "./app/start";', undefined],
    ["tests/x.ts", 'import { pages } from "@/app/routes";', undefined],
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
