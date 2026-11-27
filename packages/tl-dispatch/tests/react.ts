import { act } from "@testing-library/react";

// Testing Library is the one render harness, cleaned up after each test; `settle` runs a change
// inside React's `act`, so the renders it causes land before the next line.
export { act as settle, render } from "@testing-library/react";

/** Waits `ms` inside React's `act`, so timers and the renders they cause land first. */
export const sleep = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** Moves a mouse onto `element`, or off it with `leave`. */
export function hover(element: Element, leave = false): void {
  settle(() => {
    const [pointer, mouse] = leave
      ? ["pointerleave", "mouseleave"]
      : ["pointerenter", "mouseenter"];
    element.dispatchEvent(new PointerEvent(pointer, { bubbles: true, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent(mouse, { bubbles: true }));
    if (!leave) element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  });
}

/** Hovers `element` past the tooltip's delay, and gives the open tooltip; the mouse stays. */
export async function hoverTooltip(element: Element): Promise<Element | null> {
  hover(element);
  await sleep(700);
  return document.querySelector('[data-slot="tooltip-content"]');
}

/** The tooltip a hover on `element` opens: its side, its text and its key chips. The mouse leaves after. */
export async function tooltipOf(element: Element) {
  const popup = await hoverTooltip(element);
  const shown = {
    side: popup?.getAttribute("data-side"),
    text: popup?.textContent,
    keys: [...(popup?.querySelectorAll("kbd") ?? [])].map((kbd) => kbd.textContent),
  };
  hover(element, true);
  return shown;
}
