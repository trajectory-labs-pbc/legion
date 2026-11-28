import { afterEach, describe, expect, test } from "bun:test";

import { FORK_PREFIX, persistedStore } from "./persisted";

afterEach(() => {
  window.localStorage.clear();
});

let made = 0;
/** A store of its own for each test, so no two tests share a key. */
function counterStore(options: { version?: number; takeOlder?: () => unknown } = {}) {
  const name = `test.counter.${made++}`;
  const store = persistedStore<{ count: number }>({
    name,
    version: options.version ?? 1,
    initial: { count: 0 },
    migrate: (stored, version) => ({ count: version === 0 ? Number(stored) : -1 }),
    takeOlder: options.takeOlder,
  });
  return { key: `${FORK_PREFIX}${name}`, store };
}

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");

describe("persistedStore", () => {
  test("a store is kept under the fork's prefix, with its version", () => {
    const { key, store } = counterStore();
    store.setState({ count: 3 });
    expect(stored(key)).toEqual({ state: { count: 3 }, version: 1 });
  });

  test("a store reads what an earlier load kept", () => {
    const { key, store } = counterStore();
    window.localStorage.setItem(key, JSON.stringify({ state: { count: 5 }, version: 1 }));
    void store.persist.rehydrate();
    expect(store.getState().count).toBe(5);
  });

  test("an older version is migrated, and the migrated state is kept", () => {
    const { key, store } = counterStore({ version: 2 });
    window.localStorage.setItem(key, JSON.stringify({ state: { count: 5 }, version: 1 }));
    void store.persist.rehydrate();
    expect(store.getState().count).toBe(-1);
    expect(stored(key)).toEqual({ state: { count: -1 }, version: 2 });
  });

  test("with no key of its own, a store migrates what the browser held before it as version 0", () => {
    let older: unknown = "7";
    const { key, store } = counterStore({ takeOlder: () => older });
    expect(store.getState().count).toBe(7);
    expect(stored(key)).toEqual({ state: { count: 7 }, version: 1 });
    older = undefined;
    window.localStorage.removeItem(key);
    void store.persist.rehydrate();
    expect(store.getState().count).toBe(7);
  });

  test("a change another tab makes shows in this one", () => {
    const { key, store } = counterStore();
    window.localStorage.setItem(key, JSON.stringify({ state: { count: 9 }, version: 1 }));
    expect(store.getState().count).toBe(0);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    expect(store.getState().count).toBe(9);
  });

  test("a change to another key leaves the store as it is", () => {
    const { key, store } = counterStore();
    window.localStorage.setItem(key, JSON.stringify({ state: { count: 9 }, version: 1 }));
    window.dispatchEvent(new StorageEvent("storage", { key: `${key}.other` }));
    expect(store.getState().count).toBe(0);
  });

  test("a browser that refuses storage keeps the state in memory, and nothing throws", () => {
    const kept = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("refused", "SecurityError");
      },
    });
    try {
      const { store } = counterStore({
        takeOlder: () => window.localStorage.getItem("anything"),
      });
      expect(store.getState().count).toBe(0);
      expect(() => store.setState({ count: 4 })).not.toThrow();
      expect(store.getState().count).toBe(4);
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
  });
});
