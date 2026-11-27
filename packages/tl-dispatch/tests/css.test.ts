import { describe, expect, test } from "bun:test";

import { importedPath, parseCss } from "./css";

describe("css reader", () => {
  test("an escaped paren or quote in a selector does not move a boundary", () => {
    const { declarations } = parseCss(
      ".\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-3 svg { width: 1px; }\n.b { color: red; }"
    );
    expect(declarations.map((d) => [d.context.join(" "), d.property, d.value])).toEqual([
      [".\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-3 svg", "width", "1px"],
      [".b", "color", "red"],
    ]);
  });

  test("gives each declaration its blocks, outermost first, and its line", () => {
    const { declarations } = parseCss(
      '@import "./a.css";\n@media (prefers-reduced-motion:\n  no-preference) {\n  .a,\n  .b { COLOR: red !important; }\n}'
    );
    expect(declarations).toEqual([
      {
        property: "color",
        value: "red !important",
        context: ["@media (prefers-reduced-motion: no-preference)", ".a, .b"],
        line: 5,
      },
    ]);
  });

  test("reads an escape that names no character as U+FFFD", () => {
    const { declarations } = parseCss(":root { --\\110000 x: 1; --\\0 y: 2; --\\d800 z: 3; }");
    expect(declarations.map((d) => d.property)).toEqual(["--\ufffdx", "--\ufffdy", "--\ufffdz"]);
  });

  test("reads an at-rule without a block as a statement, with its line", () => {
    const { statements } = parseCss('.a { color: red; }\n@import url("./b.css");\n@apply x;');
    expect(statements).toEqual([
      { name: "import", prelude: 'url("./b.css")', line: 2 },
      { name: "apply", prelude: "x", line: 3 },
    ]);
    expect(importedPath(statements[0]?.prelude ?? "")).toBe("./b.css");
  });
});
