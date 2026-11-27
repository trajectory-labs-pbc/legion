import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import postcss, { AtRule, Rule } from "postcss";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "#registry/legion/ui/table";

/** `element.matches`, with each `:not(…)` checked on its own: happy-dom ignores a complex one. */
function matches(element: Element, selector: string): boolean {
  let base = "";
  const nots: string[] = [];
  for (let at = 0; at < selector.length; ) {
    if (selector.startsWith(":not(", at) && selector[at - 1] !== "\\") {
      let depth = 1;
      let end = at + ":not(".length;
      for (; depth > 0; end += 1) {
        if (selector[end] === "(") depth += 1;
        else if (selector[end] === ")") depth -= 1;
      }
      nots.push(selector.slice(at + ":not(".length, end - 1));
      at = end;
    } else {
      base += selector[at];
      at += 1;
    }
  }
  return element.matches(base) && nots.every((not) => !element.matches(not));
}

/** Whether a hover fills `row`: a generated hover rule of its classes that sets a background matches it. */
async function hoverFills(row: Element): Promise<boolean> {
  const compiler = await compile(
    '@import "tailwindcss/utilities";\n@theme { --color-secondary: #000; }',
    { base: join(import.meta.dirname, "../styles"), onDependency: () => {} }
  );
  let fills = false;
  postcss.parse(compiler.build([...row.classList])).walkDecls("background-color", (decl) => {
    const rule = decl.parent;
    const media = rule?.parent;
    if (!(rule instanceof Rule) || !(media instanceof AtRule) || media.params !== "(hover: hover)")
      return;
    if (matches(row, rule.selector.replace(/(?<!\\):hover/g, ""))) fills = true;
  });
  return fills;
}

describe("Table", () => {
  const classes = (element: Element | null) => (element?.className ?? "").split(/\s+/);

  it("is a captioned table whose links take the keyboard", async () => {
    render(
      <Table>
        <TableCaption>Open issues</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <a href="#one">ONE-1</a>
            </TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>1 issue</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    expect(screen.getByRole("table", { name: "Open issues" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Key" })).toBeDefined();
    expect(screen.getByText("1 issue").closest("tfoot")).not.toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "ONE-1" }));
  });

  it("draws one line under the header and none between body rows", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>first</TableCell>
          </TableRow>
          <TableRow aria-selected>
            <TableCell>second</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const lines = (element: Element | null) =>
      classes(element).filter((name) => /(^|:)(border|divide)(-|$)/.test(name));
    const head = screen.getByRole("columnheader", { name: "Name" });
    expect(lines(head.closest("table"))).toEqual([]);
    expect(lines(head.closest("thead"))).toEqual(["border-b"]);
    expect(lines(head.closest("tr"))).toEqual([]);
    for (const name of ["first", "second"]) {
      const cell = screen.getByRole("cell", { name });
      const row = cell.closest("tr");
      for (const element of [cell, row, row?.parentElement ?? null]) {
        expect(lines(element)).toEqual([]);
      }
    }
  });

  it("fills a body row on hover and never a header row", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>first</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const hovers = (element: Element | null) =>
      classes(element).filter((name) => /(^|:)hover:bg-/.test(name));
    const inBody = (name: string) => name.startsWith("in-data-[slot=table-body]:");
    const bodyRow = screen.getByRole("cell", { name: "first" }).closest("tr");
    expect(bodyRow?.closest("[data-slot=table-body]")).not.toBeNull();
    expect(hovers(bodyRow).filter(inBody)).toHaveLength(1);
    const headerRow = screen.getByRole("columnheader", { name: "Name" }).closest("tr");
    expect(headerRow?.closest("[data-slot=table-body]")).toBeNull();
    expect(hovers(headerRow).filter((name) => !inBody(name))).toEqual([]);
    expect(hovers(headerRow?.parentElement ?? null)).toEqual([]);
  });

  it("right-aligns a numeric head and its cells in tabular figures, and no other", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead numeric>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>build</TableCell>
            <TableCell numeric>1,204</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    for (const numeric of [
      screen.getByRole("columnheader", { name: "Size" }),
      screen.getByRole("cell", { name: "1,204" }),
    ]) {
      expect(classes(numeric)).toContain("text-right");
      expect(classes(numeric)).toContain("tabular-nums");
      expect(classes(numeric)).not.toContain("text-left");
    }
    const plainHead = classes(screen.getByRole("columnheader", { name: "Name" }));
    expect(plainHead).toContain("text-left");
    expect(plainHead).not.toContain("tabular-nums");
    const plainCell = classes(screen.getByRole("cell", { name: "build" }));
    expect(plainCell).not.toContain("text-right");
    expect(plainCell).not.toContain("tabular-nums");
  });

  it("fills a hovered row, but no row of a busy table", async () => {
    render(
      <>
        <Table>
          <TableBody>
            <TableRow data-testid="idle">
              <TableCell>ONE-1</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Table aria-busy="true">
          <TableBody>
            <TableRow data-testid="busy">
              <TableCell>Loading</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </>
    );
    expect(await hoverFills(screen.getByTestId("idle"))).toBe(true);
    expect(await hoverFills(screen.getByTestId("busy"))).toBe(false);
  });
});
