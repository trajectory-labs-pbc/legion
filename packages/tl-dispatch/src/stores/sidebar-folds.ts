import { quietly } from "@/browser/storage";
import { forkKey, persistedStore } from "./persisted";

interface SidebarFolds {
  /** The headings of the folded sidebar sections. */
  folded: readonly string[];
}

const NAME = "sidebar.folds";
/** Version 0 kept one key for each folded heading, holding the text "true". */
const OLDER_PREFIX = forkKey("sidebar.folded.");

/**
 * Moves version 0's keys under the store's key, as version 0, when the store has no key yet. The
 * old keys go only once that is written, so a refused write keeps them for the next load.
 */
export function moveOlderFolds(): void {
  const storage = window.localStorage;
  const key = forkKey(NAME);
  if (storage.getItem(key) !== null) return;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
  const older = keys.filter((each) => each.startsWith(OLDER_PREFIX));
  if (older.length === 0) return;
  const state = Object.fromEntries(
    older.map((each) => [each.slice(OLDER_PREFIX.length), storage.getItem(each)])
  );
  storage.setItem(key, JSON.stringify({ state, version: 0 }));
  for (const each of older) storage.removeItem(each);
}

quietly(moveOlderFolds);

/** The store itself; the app reads and writes it through `useFolded` and `setFolded`. */
export const sidebarFolds = persistedStore<SidebarFolds>({
  name: NAME,
  version: 1,
  initial: { folded: [] },
  migrate: (stored, version) => {
    // Version 0 is the only older version; anything else starts with no folds.
    if (version !== 0 || typeof stored !== "object" || stored === null) return { folded: [] };
    const folded = Object.entries(stored).filter(([, value]) => value === "true");
    return { folded: folded.map(([heading]) => heading) };
  },
});

/** Whether the sidebar section under `heading` is folded. */
export const useFolded = (heading: string) =>
  sidebarFolds((state) => state.folded.includes(heading));

/** Folds or opens the sidebar section under `heading`. */
export function setFolded(heading: string, folded: boolean): void {
  sidebarFolds.setState((state) => {
    const others = state.folded.filter((each) => each !== heading);
    return { folded: folded ? [...others, heading] : others };
  });
}
