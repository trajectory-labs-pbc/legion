import { afterEach, describe, expect, jest, test } from "bun:test";
import { lazy, type ReactNode, Suspense } from "react";
import { changesOutsideAct, shows } from "../../tests/outside-act";
import { render } from "../../tests/react";
import { onFakeClock, tick } from "../../tests/upstream";
import { PageFallback, useSkeleton } from "./page-skeleton";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("PageFallback", () => {
  test("SHL-43 draws nothing for 200 ms, then a page-neutral skeleton: a title and rows, no issue tabs", async () => {
    await onFakeClock(async () => {
      const start = Date.now();
      const view = render(<PageFallback />);
      cleanups.push(() => view.unmount());
      await tick(198);
      expect(Date.now() - start).toBe(199);
      expect(view.container.innerHTML).toBe("");
      await tick(0);
      expect(Date.now() - start).toBe(200);
      const skeleton = view.container.querySelector('[role="status"]');
      expect(skeleton?.getAttribute("aria-label")).toBe("Loading the page");
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
      const boxes = [...(skeleton?.querySelectorAll('[data-slot="skeleton"]') ?? [])];
      expect(
        boxes.map((box) => box.className.split(" ").find((word) => word.startsWith("h-")))
      ).toEqual(["h-control-sm", "h-9", "h-9", "h-9", "h-9"]);
    });
  });

  test("SHL-43 outside act, a page whose code comes at 100 ms shows after about 300 ms, and no skeleton before 200 ms", async () => {
    const Page = lazy(
      () =>
        new Promise<{ default: () => ReactNode }>((resolve) =>
          setTimeout(() => resolve({ default: () => <h1>The page</h1> }), 100)
        )
    );
    const changes = await changesOutsideAct(
      <Suspense fallback={<PageFallback />}>
        <Page />
      </Suspense>,
      (host) =>
        shows(host, "h1") ? "page" : shows(host, '[role="status"]') ? "skeleton" : "blank",
      { done: (state) => state === "page" }
    );
    const page = changes.find((change) => change.state === "page");
    const skeleton = changes.find((change) => change.state === "skeleton");
    // Bun drops the fraction of the delay React's throttle gives setTimeout, so its timer can fire
    // up to 1 ms early, and React commits at once when 10 ms or less of its 300 ms throttle remain.
    expect(page?.at).toBeGreaterThanOrEqual(290);
    expect(skeleton === undefined || skeleton.at >= 200).toBe(true);
  });
});

describe("useSkeleton", () => {
  function Probe({ waiting }: { waiting: boolean }): ReactNode {
    return useSkeleton(waiting) ? "skeleton" : "content";
  }

  test("a wait shorter than 200 ms shows no skeleton", async () => {
    await onFakeClock(async () => {
      const view = render(<Probe waiting />);
      cleanups.push(() => view.unmount());
      await tick(150);
      expect(view.container.textContent).toBe("content");
      view.rerender(<Probe waiting={false} />);
      await tick(400);
      expect(view.container.textContent).toBe("content");
    });
  });

  test("a skeleton shown at 200 ms whose wait ends at 251 ms stays until 500 ms", async () => {
    await onFakeClock(async () => {
      const start = Date.now();
      const view = render(<Probe waiting />);
      cleanups.push(() => view.unmount());
      await tick(250);
      expect(view.container.textContent).toBe("skeleton");
      view.rerender(<Probe waiting={false} />);
      // Shown at 200 ms, so held until 500 ms: still there at 499 ms, gone at 500 ms.
      await tick(247);
      expect(Date.now() - start).toBe(499);
      expect(view.container.textContent).toBe("skeleton");
      await tick(0);
      expect(Date.now() - start).toBe(500);
      expect(view.container.textContent).toBe("content");
    });
  });

  test("a skeleton that has stood 300 ms goes as soon as its wait ends", async () => {
    await onFakeClock(async () => {
      const view = render(<Probe waiting />);
      cleanups.push(() => view.unmount());
      await tick(900);
      expect(view.container.textContent).toBe("skeleton");
      view.rerender(<Probe waiting={false} />);
      await tick(0);
      expect(view.container.textContent).toBe("content");
    });
  });

  test("a clock set back while a skeleton shows holds it no longer than 300 ms", async () => {
    await onFakeClock(async () => {
      const view = render(<Probe waiting />);
      cleanups.push(() => view.unmount());
      await tick(250);
      expect(view.container.textContent).toBe("skeleton");
      jest.setSystemTime(Date.now() - 60_000);
      view.rerender(<Probe waiting={false} />);
      await tick(300);
      expect(view.container.textContent).toBe("content");
    });
  });
});
