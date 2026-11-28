import { afterEach, describe, expect, test } from "bun:test";

import { FORK_PREFIX, persistedStore } from "./persisted";

afterEach(() => {
  window.localStorage.clear();
});

let made = 0;
/** A store of its own for each test, so no two tests share a key. */
function counterStore(version = 1) {
  const name = `test.counter.${made++}`;
  const store = persistedStore<{ count: number }>({
    name,
    version,
    initial: { count: 0 },
    migrate: () => ({ count: -1 }),
  });
  return { key: `${FORK_PREFIX}${name}`, store };
}

const keep = (key: string, count: number, version: number) =>
  window.localStorage.setItem(key, JSON.stringify({ state: { count }, version }));
const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");

describe("persistedStore", () => {
  test("a store is kept under the fork's prefix, with its version", () => {
    const { key, store } = counterStore();
    store.setState({ count: 3 });
    expect(stored(key)).toEqual({ state: { count: 3 }, version: 1 });
  });

  test("a store reads what an earlier load kept", () => {
    const { key, store } = counterStore();
    keep(key, 5, 1);
    void store.persist.rehydrate();
    expect(store.getState().count).toBe(5);
  });

  test("an older version is migrated, and the migrated state is kept", () => {
    const { key, store } = counterStore(2);
    keep(key, 5, 1);
    void store.persist.rehydrate();
    expect(store.getState().count).toBe(-1);
    expect(stored(key)).toEqual({ state: { count: -1 }, version: 2 });
  });

  test("a newer version, from a tab on a newer build, is neither read nor written over", () => {
    const { key, store } = counterStore(1);
    store.setState({ count: 2 });
    keep(key, 5, 2);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    expect(store.getState().count).toBe(2);
    expect(stored(key)).toEqual({ state: { count: 5 }, version: 2 });
  });

  test("a change another tab makes shows in this one", () => {
    const { key, store } = counterStore();
    keep(key, 9, 1);
    expect(store.getState().count).toBe(0);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    expect(store.getState().count).toBe(9);
  });

  test("a change to another key leaves the store as it is", () => {
    const { key, store } = counterStore();
    keep(key, 9, 1);
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
      const { store } = counterStore();
      expect(store.getState().count).toBe(0);
      expect(() => store.setState({ count: 4 })).not.toThrow();
      expect(store.getState().count).toBe(4);
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
  });
});
