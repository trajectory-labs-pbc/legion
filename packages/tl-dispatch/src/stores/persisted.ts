import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { quietly } from "@/browser/storage";

/** The prefix of each key of the fork's own, so none meets a key of upstream's. */
export const FORK_PREFIX = "tl-dispatch.";

export interface StoreOptions<State> {
  /** The key's name, after the fork's prefix. */
  name: string;
  version: number;
  initial: State;
  /** The state at `version` from what an older version stored. */
  migrate: (stored: unknown, version: number) => State;
  /** Version 0: what the browser held before this store, read once when its key is absent. */
  takeOlder?: () => unknown;
}

/**
 * A store this browser keeps under the fork's prefix, by version. A change made in another tab
 * shows here: the other tab writes the key, and this one reads it again. A browser that refuses
 * storage leaves the store in memory only.
 */
export function persistedStore<State extends object>(options: StoreOptions<State>) {
  const { initial, migrate, takeOlder, version } = options;
  const name = `${FORK_PREFIX}${options.name}`;
  // `persist` keeps the first state when a read throws, so only a write needs `quietly`.
  const storage = createJSONStorage(() => ({
    getItem: (key: string) => {
      const stored = window.localStorage.getItem(key);
      if (stored !== null || takeOlder === undefined) return stored;
      const state = takeOlder();
      return state === undefined ? null : JSON.stringify({ state, version: 0 });
    },
    setItem: (key: string, value: string) => {
      quietly(() => window.localStorage.setItem(key, value));
    },
    removeItem: (key: string) => {
      quietly(() => window.localStorage.removeItem(key));
    },
  }));
  const store = create<State>()(persist(() => initial, { name, version, migrate, storage }));
  window.addEventListener("storage", (event) => {
    if (event.key === name || event.key === null) void store.persist.rehydrate();
  });
  return store;
}
