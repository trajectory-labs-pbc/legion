import { describe, expect, test } from "bun:test";

import { parseCss } from "./css";

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

  test("an escaped paren opens no group, so the next rule stays its own", () => {
    const { declarations } = parseCss(".a\\( { width: 1px; }\n.b { color: red; }");
    expect(declarations.map((d) => d.property)).toEqual(["width", "color"]);
  });
});
