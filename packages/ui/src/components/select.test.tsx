import { describe, expect, it, vi } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "#registry/legion/ui/select";

const items = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

describe("Select", () => {
  it("opens from the keyboard, moves with the arrows and picks on Enter", async () => {
    const onValueChange = vi.fn();
    render(
      <Select items={items} defaultValue="open" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger.textContent).toContain("Open");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Done"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onValueChange).toHaveBeenCalledWith("done", expect.anything());
    expect(trigger.textContent).toContain("Done");
  });

  it("closes on Escape without a change", async () => {
    const onValueChange = vi.fn();
    render(
      <Select items={items} defaultValue="open" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("labels its groups and moves across them with the arrows", async () => {
    const onValueChange = vi.fn();
    render(
      <Select items={items} defaultValue="open" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Active</SelectLabel>
            <SelectItem value="open">Open</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Closed</SelectLabel>
            <SelectItem value="done">Done</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    expect(screen.getByRole("group", { name: "Active" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Closed" })).toBeDefined();
    // A listbox holds no separator role, so Base UI draws it as presentation.
    expect(
      document.querySelectorAll("[data-slot=select-separator][role=presentation]").length
    ).toBe(1);
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Done"));
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("done", expect.anything());
  });

  it("marks the chosen item, and only it", async () => {
    render(
      <Select items={items} defaultValue="open">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const marked = (name: string) =>
      screen
        .getByRole("option", { name })
        .querySelector("[data-slot=select-item-indicator] svg") !== null;
    await waitFor(() => expect(marked("Open")).toBe(true));
    expect(marked("Done")).toBe(false);
  });
});
