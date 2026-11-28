import { describe, expect, it, jest } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createToastManager,
  type ToastData,
  ToastProvider,
  ToastViewport,
} from "#registry/legion/ui/toast";

function renderToasts() {
  const manager = createToastManager<ToastData>();
  render(
    <ToastProvider timeout={0} toastManager={manager}>
      <ToastViewport />
    </ToastProvider>
  );
  return manager;
}

describe("Toast", () => {
  it("is one line in a polite region that is there before any toast, and takes no focus", () => {
    const manager = renderToasts();
    const region = screen.getByRole("region");
    expect(region.getAttribute("aria-live")).toBe("polite");
    act(() => {
      manager.add({ data: { icon: <svg data-testid="icon" /> }, title: "Copied" });
    });
    expect(screen.getByRole("dialog").textContent).toBe("Copied");
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(region.contains(document.activeElement)).toBe(false);
  });

  it("announces a failure at once, keeps the rest of its message in its tooltip once, and offers its action", async () => {
    const manager = renderToasts();
    const onClick = jest.fn();
    act(() => {
      manager.add({
        actionProps: { children: "Retry", onClick },
        data: { shortcut: { caps: [["⇧", "Z"]], keys: "Shift+Z" } },
        description: "Dispatch refused the snooze. Try again later.",
        priority: "high",
        title: "Could not snooze",
        type: "danger",
      });
    });
    expect(screen.getByRole("alert").textContent).toContain("Could not snooze");
    const toast = screen.getByRole("alertdialog", { hidden: true });
    expect(toast.getAttribute("data-type")).toBe("danger");
    expect(toast.getAttribute("title")).toBe("Dispatch refused the snooze. Try again later.");
    expect(toast.textContent).toBe("Could not snoozeRetry⇧Z");
    const action = screen.getByRole("button", { hidden: true, name: "Retry" });
    expect(action.getAttribute("aria-keyshortcuts")).toBe("Shift+Z");
    await userEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("draws the oldest first and stays on Escape", async () => {
    const manager = renderToasts();
    act(() => {
      manager.add({ title: "Dismissed 2" });
      manager.add({ title: "Snoozed 3" });
    });
    const toasts = screen.getAllByRole("dialog");
    expect(toasts.map((toast) => toast.textContent)).toEqual(["Dismissed 2", "Snoozed 3"]);
    act(() => (toasts[0] as HTMLElement).focus());
    await userEvent.keyboard("{Escape}");
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
  });
});
