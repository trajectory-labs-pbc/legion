import { describe, expect, it, vi } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxValue,
  useComboboxAnchor,
} from "#registry/legion/ui/combobox";

const fruits = ["Apple", "Banana", "Cherry"];

function Single({ onValueChange }: { onValueChange: (value: string | null) => void }) {
  return (
    <Combobox items={fruits} onValueChange={onValueChange}>
      <ComboboxInput aria-label="Fruit" showClear />
      <ComboboxContent>
        <ComboboxEmpty>No match</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function Multiple() {
  const anchor = useComboboxAnchor();
  return (
    <Combobox items={fruits} multiple defaultValue={["Apple"]}>
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: string[]) =>
            values.map((value) => <ComboboxChip key={value}>{value}</ComboboxChip>)
          }
        </ComboboxValue>
        <ComboboxChipsInput aria-label="Fruits" />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

interface ProduceGroup {
  value: string;
  items: string[];
}

const produce: ProduceGroup[] = [
  { value: "Fruits", items: ["Apple", "Banana"] },
  { value: "Vegetables", items: ["Carrot", "Leek"] },
];

function Grouped({ onValueChange }: { onValueChange: (value: string | null) => void }) {
  return (
    <Combobox items={produce} onValueChange={onValueChange}>
      <ComboboxInput aria-label="Produce" />
      <ComboboxContent>
        <ComboboxList>
          {(group: ProduceGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {group.value === "Vegetables" && <ComboboxSeparator />}
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

describe("Combobox", () => {
  it("filters as it is typed, moves with the arrows and picks on Enter", async () => {
    const onValueChange = vi.fn();
    render(<Single onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox", { name: "Fruit" });
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("an");
    await screen.findByRole("listbox");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Banana"]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Banana", expect.anything());
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect((input as HTMLInputElement).value).toBe("Banana");
  });

  it("closes on Escape and clears from its labelled button", async () => {
    const onValueChange = vi.fn();
    render(<Single onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await userEvent.keyboard("ch{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith("Cherry", expect.anything());
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange).toHaveBeenLastCalledWith(null, expect.anything());
  });

  it("removes a chip from its labelled button", async () => {
    render(<Multiple />);
    expect(screen.getByText("Apple")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("Apple")).toBeNull());
  });

  it("filters inside its labelled groups and moves across them with the arrows", async () => {
    const onValueChange = vi.fn();
    render(<Grouped onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("e");
    await screen.findByRole("listbox");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Apple",
      "Leek",
    ]);
    expect(screen.getByRole("group", { name: "Fruits" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Vegetables" })).toBeDefined();
    // A listbox holds no separator role, so Base UI draws it as presentation.
    expect(
      document.querySelectorAll("[data-slot=combobox-separator][role=presentation]").length
    ).toBe(1);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Leek", expect.anything());
  });

  it("names its open button, in the label it is given", async () => {
    const { unmount } = render(<Single onValueChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("listbox")).toBeDefined();
    unmount();
    render(
      <Combobox items={fruits}>
        <ComboboxInput aria-label="Fruit" triggerLabel="Show fruits" />
      </Combobox>
    );
    expect(screen.getByRole("button", { name: "Show fruits" })).toBeDefined();
  });
});
