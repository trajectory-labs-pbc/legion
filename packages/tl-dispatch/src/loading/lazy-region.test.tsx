import { afterEach, describe, expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import { quietConsoleError } from "@upstream-dispatch/__tests__/act-warnings";

import { lazyOverlay, lazyRegion } from "./lazy-region";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function Piece({ word }: { word: string }) {
  return <p data-piece="">{word}</p>;
}

/** navigator.onLine as the test sets it. */
function network(online: boolean) {
  let now = online;
  // An own property shadows the prototype's getter; deleting it restores the real one.
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => now });
  cleanups.push(() => Reflect.deleteProperty(navigator, "onLine"));
  return {
    reconnect() {
      now = true;
      window.dispatchEvent(new Event("online"));
    },
  };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe("lazyRegion", () => {
  test("a chunk that fails online shows its region's error alone; the rest stays", async () => {
    // The error boundary logs the chunk's failure.
    quietConsoleError();
    network(true);
    const Lazy = lazyRegion(
      "the shortcuts sheet",
      (): Promise<{ Piece: typeof Piece }> => Promise.reject(new Error("chunk gone")),
      "Piece"
    );
    const view = render(
      <>
        <p data-shell="">shell</p>
        <Lazy word="piece" />
      </>
    );
    await flush();
    expect(view.container.querySelector("[data-shell]")?.textContent).toBe("shell");
    const alert = view.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong in the shortcuts sheet.");
    expect(alert?.textContent).toContain("chunk gone");
  });

  test("a chunk that fails offline loads when the network returns", async () => {
    const { reconnect } = network(false);
    let tries = 0;
    const Lazy = lazyRegion(
      "the shortcuts sheet",
      () => {
        tries += 1;
        return tries === 1 ? Promise.reject(new Error("offline")) : Promise.resolve({ Piece });
      },
      "Piece"
    );
    const view = render(<Lazy word="piece" />);
    await flush();
    expect(view.container.querySelector("[data-piece]")).toBeNull();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    reconnect();
    await flush();
    expect(tries).toBe(2);
    expect(view.container.querySelector("[data-piece]")?.textContent).toBe("piece");
  });
});

describe("lazyOverlay", () => {
  function Sheet({ open, word }: { open: boolean; word: string }) {
    return <p data-sheet={open ? "open" : "closed"}>{word}</p>;
  }

  test("loads nothing until it first opens, then keeps its view for its close", async () => {
    let loads = 0;
    const Lazy = lazyOverlay(
      "the sheet",
      () => {
        loads += 1;
        return Promise.resolve({ Sheet });
      },
      "Sheet"
    );
    const view = render(<Lazy open={false} word="keys" />);
    await flush();
    expect(loads).toBe(0);
    expect(view.container.querySelector("[data-sheet]")).toBeNull();
    view.rerender(<Lazy open word="keys" />);
    await flush();
    expect(view.container.querySelector("[data-sheet]")?.getAttribute("data-sheet")).toBe("open");
    view.rerender(<Lazy open={false} word="keys" />);
    await flush();
    expect(view.container.querySelector("[data-sheet]")?.getAttribute("data-sheet")).toBe("closed");
    expect(loads).toBe(1);
  });
});
