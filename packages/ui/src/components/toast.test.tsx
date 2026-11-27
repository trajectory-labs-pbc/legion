import { describe, expect, it, jest } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Toast, ToastHost } from "#registry/legion/ui/toast";

describe("Toast", () => {
  it("is one line, announced politely, with no action and no focus", () => {
    const { container } = render(<Toast icon={<svg data-testid="icon" />} text="Copied" />);
    const toast = screen.getByRole("status");
    expect(toast.textContent).toBe("Copied");
    expect(screen.getByText("Copied").className).toContain("truncate");
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.contains(document.activeElement)).toBe(false);
  });

  it("is a floating surface with an edge and nothing cast under it", () => {
    render(<Toast text="Snoozed" />);
    const classes = (screen.getByRole("status").getAttribute("class") ?? "").split(" ");
    expect(classes).toContain("bg-popover");
    expect(classes).toContain("border");
    expect(classes.filter((name) => name.startsWith("shadow-"))).toEqual([]);
  });

  it("announces a failure at once, keeps the rest of its message in its tooltip, and offers its action", async () => {
    const onPress = jest.fn();
    render(
      <Toast
        action={{ label: "Retry", onPress, shortcut: [["⇧", "Z"]] }}
        detail="Dispatch refused the snooze. Try again later."
        icon={<svg data-testid="icon" />}
        text="Could not snooze"
        tone="failure"
      />
    );
    const toast = screen.getByRole("alert");
    expect(toast.getAttribute("aria-description")).toBe(
      "Dispatch refused the snooze. Try again later."
    );
    expect(toast.textContent).toBe("Could not snoozeRetry⇧Z");
    expect(screen.getByTestId("icon").parentElement?.className).toContain("text-danger");
    await userEvent.click(screen.getByRole("button", { name: "Retry ⇧ Z" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button").querySelectorAll("kbd")).toHaveLength(2);
  });

  it("holds the rest of its message in its text's tooltip", () => {
    render(<Toast detail="The second line." text="The first line" />);
    expect(screen.getByText("The first line").getAttribute("title")).toBe("The second line.");
    expect(screen.getByRole("status").textContent).toBe("The first line");
  });
});

describe("ToastHost", () => {
  it("draws its caller's toasts in order and reports the pointer on each", () => {
    const onHoverChange = jest.fn();
    render(
      <ToastHost
        onHoverChange={onHoverChange}
        toasts={[
          { id: "a", text: "Dismissed 2" },
          { id: "b", text: "Snoozed 3" },
        ]}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Dismissed 2", "Snoozed 3"]);
    fireEvent.pointerEnter(items[1] as HTMLElement);
    expect(onHoverChange).toHaveBeenLastCalledWith("b", true);
    fireEvent.pointerLeave(items[1] as HTMLElement);
    expect(onHoverChange).toHaveBeenLastCalledWith("b", false);
  });

  it("draws an empty list with no toast", () => {
    render(<ToastHost onHoverChange={() => {}} toasts={[]} />);
    expect(screen.getByRole("list").children).toHaveLength(0);
  });
});
