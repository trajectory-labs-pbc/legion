import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { act } from "react";

import { render } from "../../tests/react";
import { lazyRegion } from "./shortcuts-sheet";

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
    const logged = spyOn(console, "error").mockImplementation(() => {});
    cleanups.push(() => logged.mockRestore());
    network(true);
    const Lazy = lazyRegion<{ word: string }>("the shortcuts sheet", () =>
      Promise.reject(new Error("chunk gone"))
    );
    const view = render(
      <>
        <p data-shell="">shell</p>
        <Lazy word="piece" />
      </>
    );
    cleanups.push(() => view.unmount());
    await flush();
    expect(view.container.querySelector("[data-shell]")?.textContent).toBe("shell");
    const alert = view.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong in the shortcuts sheet.");
    expect(alert?.textContent).toContain("chunk gone");
  });

  test("a chunk that fails offline loads when the network returns", async () => {
    const { reconnect } = network(false);
    let tries = 0;
    const Lazy = lazyRegion("the shortcuts sheet", () => {
      tries += 1;
      return tries === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(Piece);
    });
    const view = render(<Lazy word="piece" />);
    cleanups.push(() => view.unmount());
    await flush();
    expect(view.container.querySelector("[data-piece]")).toBeNull();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    reconnect();
    await flush();
    expect(tries).toBe(2);
    expect(view.container.querySelector("[data-piece]")?.textContent).toBe("piece");
  });
});
