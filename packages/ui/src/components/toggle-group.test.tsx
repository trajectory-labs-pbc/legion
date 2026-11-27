import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToggleGroup, ToggleGroupItem } from "#registry/legion/ui/toggle-group";

describe("ToggleGroup", () => {
  it("moves the focus with the arrows and presses on Space", async () => {
    render(
      <ToggleGroup aria-label="View" defaultValue={["list"]} variant="outline" size="sm">
        <ToggleGroupItem value="list">List</ToggleGroupItem>
        <ToggleGroupItem value="board">Board</ToggleGroupItem>
      </ToggleGroup>
    );
    await userEvent.tab();
    const list = screen.getByRole("button", { name: "List" });
    const board = screen.getByRole("button", { name: "Board" });
    expect(document.activeElement).toBe(list);
    expect(list.getAttribute("aria-pressed")).toBe("true");
    for (const item of [list, board]) {
      expect(item.getAttribute("data-variant")).toBe("outline");
      expect(item.getAttribute("data-size")).toBe("sm");
    }
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(board);
    await userEvent.keyboard(" ");
    expect(board.getAttribute("aria-pressed")).toBe("true");
    expect(list.getAttribute("aria-pressed")).toBe("false");
  });
});
