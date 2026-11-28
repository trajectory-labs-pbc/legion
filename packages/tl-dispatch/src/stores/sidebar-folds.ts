import { FORK_PREFIX, persistedStore } from "./persisted";

interface SidebarFolds {
  /** The headings of the folded sidebar sections. */
  folded: readonly string[];
}

/** Version 0 kept one key for each folded heading, holding the text "true". */
const OLDER_PREFIX = `${FORK_PREFIX}sidebar.folded.`;

/** Version 0's keys, by heading, with what each held; each is removed once read. */
function takeOlder(): Record<string, string> | undefined {
  const storage = window.localStorage;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
  const older: Record<string, string> = {};
  for (const key of keys.filter((each) => each.startsWith(OLDER_PREFIX))) {
    older[key.slice(OLDER_PREFIX.length)] = storage.getItem(key) ?? "";
    storage.removeItem(key);
  }
  return Object.keys(older).length === 0 ? undefined : older;
}

/** The store itself; the app reads and writes it through `useFolded` and `setFolded`. */
export const sidebarFolds = persistedStore<SidebarFolds>({
  name: "sidebar.folds",
  version: 1,
  initial: { folded: [] },
  migrate: (stored, version) => {
    if (version !== 0 || typeof stored !== "object" || stored === null) return { folded: [] };
    const folded = Object.entries(stored).filter(([, value]) => value === "true");
    return { folded: folded.map(([heading]) => heading) };
  },
  takeOlder,
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
