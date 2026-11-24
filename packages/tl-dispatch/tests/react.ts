import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mounts `element` into the test document; `unmount` removes it. */
export function render(element: ReactNode): { unmount(): void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Runs `change` inside React's `act`, so the renders it causes land before the next line. */
export function settle(change: () => void): void {
  act(change);
}
