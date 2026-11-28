import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { quietly } from "@/browser/storage";

/** The stored name of the fork's key `name`: under the fork's prefix, so it meets no key of upstream's. */
export const forkKey = (name: string) => `tl-dispatch.${name}`;

/** Each store's way back to its first state with its key removed. */
const resets: (() => void)[] = [];

/** Puts each store back to its first state and removes its key; the tests do it before each test. */
export function resetStores(): void {
  for (const reset of resets) reset();
}

interface StoreOptions<State> {
  /** The key's name, after the fork's prefix. */
  name: string;
  version: number;
  initial: State;
  /** The state at `version` from what an older version stored. */
  migrate: (stored: unknown, version: number) => State;
}

/**
 * A store this browser keeps under the fork's prefix, by version. A change made in another tab
 * shows here: the other tab writes the key, and this one reads it again. A browser that refuses
 * storage leaves the store in memory only.
 */
export function persistedStore<State extends object>(options: StoreOptions<State>) {
  const { initial, migrate, version } = options;
  const name = forkKey(options.name);
  // `persist` keeps the first state when a read throws, so only a write needs `quietly`.
  const storage = createJSONStorage(() => ({
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      quietly(() => window.localStorage.setItem(key, value));
    },
    removeItem: (key: string) => {
      quietly(() => window.localStorage.removeItem(key));
    },
  }));
  const store = create<State>()(
    persist(() => initial, {
      name,
      version,
      storage,
      // A newer version, from a tab on a newer build, is left as it is: the throw stops `persist`
      // before it writes, and this tab keeps its state.
      migrate: (stored, from) => {
        if (from > version) throw new Error(`${name} is at version ${from}, newer than ${version}`);
        return migrate(stored, from);
      },
    })
  );
  window.addEventListener("storage", (event) => {
    if (event.key === name || event.key === null) void store.persist.rehydrate();
  });
  resets.push(() => {
    store.setState(store.getInitialState(), true);
    store.persist.clearStorage();
  });
  return store;
}
