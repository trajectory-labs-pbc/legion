import { describe, expect, test } from "bun:test";

import { layerViolations } from "./layering";
import { sourceFiles } from "./source";

describe("layers", () => {
  test("no file of the app crosses a layer", () => {
    expect(layerViolations(sourceFiles())).toEqual([]);
  });

  test.each([
    [
      "src/ui/button.tsx",
      'import { x } from "@upstream-dispatch/theme/classes";',
      "outside src/ui",
    ],
    ["src/ui/button.tsx", 'import { Link } from "react-router-dom";', "no router"],
    ["src/ui/button.tsx", 'import { useRouter } from "@tanstack/react-router";', "no router"],
    ["src/ui/button.tsx", 'import { useQuery } from "@tanstack/react-query";', "no data"],
    [
      "src/ui/button.tsx",
      'import { appCatalog } from "../commands/app-catalog";',
      "outside src/ui",
    ],
    ["src/ui/theme-extra.css", '@import "../../../dispatch/web/src/styles.css";', "outside src/ui"],
    ["src/shell/Shell.tsx", 'import { App } from "@upstream-dispatch/app";', "second sign-in"],
    [
      "src/shell/Shell.tsx",
      'import { App } from "../../../dispatch/web/src/app.tsx";',
      "second sign-in",
    ],
    ["src/pages/x.tsx", 'const app = import("../../../dispatch/web/src/app");', "second sign-in"],
    [
      "src/commands/nav.ts",
      'import { useNavigate } from "react-router-dom";',
      "never imports navigation",
    ],
  ])("refuses %s: %s", (path, text, rule) => {
    const violations = layerViolations([{ path, text }]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain(rule);
  });

  test.each([
    ["src/ui/button.tsx", 'import { cn } from "./cn";'],
    ["src/ui/button.tsx", 'import { cva } from "class-variance-authority";'],
    [
      "src/shell/Shell.tsx",
      'import { Sidebar } from "@upstream-dispatch/features/sidebar/Sidebar";',
    ],
    ["src/ui/button.tsx", '// import { App } from "@upstream-dispatch/app";'],
  ])("allows %s: %s", (path, text) => {
    expect(layerViolations([{ path, text }])).toEqual([]);
  });
});
