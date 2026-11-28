import { createJSONStorage } from "zustand/middleware";
import { quietly } from "@/browser/storage";

/**
 * Where a store keeps its state for this browser: `localStorage`, read on each call. `persist`
 * catches a refused read, but not a write.
 *
 * A change to the stored shape bumps `version` and adds a `migrate` from the older one; that
 * `migrate` throws for a newer version, or two tabs on two builds rewrite the key without end.
 * With no `migrate`, a newer version is not read, but this tab's next change writes over it.
 */
export const browserStorage = <S>() =>
  createJSONStorage<S>(() => ({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => quietly(() => window.localStorage.setItem(key, value)),
    removeItem: (key) => window.localStorage.removeItem(key),
  }));

/** The part of a `persist` store that another tab's change reaches. */
interface KeptStore {
  persist: { getOptions: () => { name?: string }; rehydrate: () => Promise<void> | void };
}

/** Shows another tab's change in this one, so this tab's next change does not write over it. */
export function followOtherTabs(store: KeptStore): void {
  window.addEventListener("storage", (event) => {
    if (event.key === store.persist.getOptions().name) void store.persist.rehydrate();
  });
}
