import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "#registry/legion/ui/native-select";

describe("NativeSelect", () => {
  it("is the browser's own select: it takes the focus and changes its value", async () => {
    const onChange = vi.fn();
    render(
      <NativeSelect aria-label="Priority" defaultValue="p2" onChange={onChange}>
        <NativeSelectOptGroup label="Urgent">
          <NativeSelectOption value="p0">P0</NativeSelectOption>
          <NativeSelectOption value="p1">P1</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOption value="p2">P2</NativeSelectOption>
      </NativeSelect>
    );
    const select = screen.getByRole("combobox", { name: "Priority" });
    expect(select.tagName).toBe("SELECT");
    await userEvent.tab();
    expect(document.activeElement).toBe(select);
    await userEvent.selectOptions(select, "p1");
    expect((select as HTMLSelectElement).value).toBe("p1");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves the tab order when disabled", async () => {
    render(
      <>
        <NativeSelect aria-label="Off" disabled>
          <NativeSelectOption value="a">A</NativeSelectOption>
        </NativeSelect>
        <button type="button">After</button>
      </>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});
