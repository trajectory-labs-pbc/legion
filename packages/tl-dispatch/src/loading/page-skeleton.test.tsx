import { afterEach, describe, expect, jest, test } from "bun:test";
import { realClock, tick } from "@upstream-dispatch/__tests__/fake-clock";

import { render } from "../../tests/react";
import { PageFallback } from "./page-skeleton";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("PageFallback", () => {
  test("draws nothing for 200 ms, then a page-neutral skeleton: a title and rows, no issue tabs", async () => {
    jest.useFakeTimers();
    try {
      const view = render(<PageFallback />);
      cleanups.push(() => view.unmount());
      await tick(150);
      expect(view.container.innerHTML).toBe("");
      await tick(100);
      const skeleton = view.container.querySelector('[role="status"]');
      expect(skeleton?.getAttribute("aria-label")).toBe("Loading the page");
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
      const boxes = [...(skeleton?.querySelectorAll('[data-slot="skeleton"]') ?? [])];
      expect(
        boxes.map((box) => box.className.split(" ").find((word) => word.startsWith("h-")))
      ).toEqual(["h-7", "h-9", "h-9", "h-9", "h-9"]);
    } finally {
      realClock();
    }
  });
});
