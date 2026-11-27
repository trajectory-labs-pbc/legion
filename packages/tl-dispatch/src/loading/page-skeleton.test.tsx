import { afterEach, describe, expect, test } from "bun:test";
import { type ReactNode, use } from "react";
import { render, settle } from "../../tests/react";
import { onFakeClock, tick } from "../../tests/upstream";
import { PageFallback, PageSuspense, useSkeleton } from "./page-skeleton";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const skeletonOf = (root: HTMLElement) => root.querySelector('[role="status"]');

describe("PageFallback", () => {
  test("SHL-43 draws nothing for 200 ms, then a page-neutral skeleton: a title and rows, no issue tabs", async () => {
    await onFakeClock(async () => {
      const view = render(<PageFallback />);
      cleanups.push(() => view.unmount());
      await tick(150);
      expect(view.container.innerHTML).toBe("");
      await tick(100);
      const skeleton = skeletonOf(view.container);
      expect(skeleton?.getAttribute("aria-label")).toBe("Loading the page");
      expect(skeleton?.getAttribute("aria-busy")).toBe("true");
      const boxes = [...(skeleton?.querySelectorAll('[data-slot="skeleton"]') ?? [])];
      expect(
        boxes.map((box) => box.className.split(" ").find((word) => word.startsWith("h-")))
      ).toEqual(["h-control-sm", "h-9", "h-9", "h-9", "h-9"]);
    });
  });

  test("SHL-43 a page whose code comes 50 ms after the skeleton showed waits until it has stood 300 ms", async () => {
    await onFakeClock(async () => {
      const code = Promise.withResolvers<void>();
      function Page(): ReactNode {
        use(code.promise);
        return <h1>The page</h1>;
      }
      const view = await settle(async () =>
        render(
          <PageSuspense fallback={<PageFallback />}>
            <Page />
          </PageSuspense>
        )
      );
      cleanups.push(() => view.unmount());
      await tick(250);
      expect(skeletonOf(view.container)).not.toBeNull();
      code.resolve();
      await tick(200);
      expect(skeletonOf(view.container)).not.toBeNull();
      expect(view.container.querySelector("h1")).toBeNull();
      await tick(100);
      expect(skeletonOf(view.container)).toBeNull();
      expect(view.container.querySelector("h1")?.textContent).toBe("The page");
    });
  });

  test("SHL-43 a page whose code comes before 200 ms draws no skeleton", async () => {
    await onFakeClock(async () => {
      const code = Promise.withResolvers<void>();
      function Page(): ReactNode {
        use(code.promise);
        return <h1>The page</h1>;
      }
      const view = await settle(async () =>
        render(
          <PageSuspense fallback={<PageFallback />}>
            <Page />
          </PageSuspense>
        )
      );
      cleanups.push(() => view.unmount());
      await tick(100);
      code.resolve();
      for (let step = 0; step < 6; step += 1) {
        await tick(50);
        expect(skeletonOf(view.container)).toBeNull();
      }
      expect(view.container.querySelector("h1")?.textContent).toBe("The page");
    });
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

  test("a skeleton whose wait ends 50 ms after it showed stays until it has stood 300 ms", async () => {
    await onFakeClock(async () => {
      const view = render(<Probe waiting />);
      cleanups.push(() => view.unmount());
      await tick(250);
      expect(view.container.textContent).toBe("skeleton");
      view.rerender(<Probe waiting={false} />);
      await tick(200);
      expect(view.container.textContent).toBe("skeleton");
      await tick(100);
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
});
