import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

describe("Table", () => {
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
});
