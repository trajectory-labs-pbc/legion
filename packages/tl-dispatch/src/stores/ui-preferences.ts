import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { quietly } from "@/browser/storage";

/**
 * What a person sets in the UI and expects after a reload: today, the sidebar's folded sections.
 *
 * A change to the stored shape bumps `version` and adds a `migrate` from the older one; that
 * `migrate` throws for a newer version, or two tabs on two builds rewrite the key without end.
 * With no `migrate`, a newer version is not read, but this tab's next change writes over it.
 */
interface UiPreferences {
  /** The headings of the folded sidebar sections. */
  sidebarFolds: Readonly<Record<string, true>>;
  toggleSidebarFold: (heading: string) => void;
}

export const useUiPreferences = create<UiPreferences>()(
  persist(
    (set) => ({
      sidebarFolds: {},
      toggleSidebarFold: (heading) =>
        set(({ sidebarFolds: { [heading]: folded, ...others } }) => ({
          sidebarFolds: folded ? others : { ...others, [heading]: true },
        })),
    }),
    {
      name: "tl-dispatch.ui-preferences",
      version: 1,
      // Reads `localStorage` on each call. `persist` catches a refused read, but not a write.
      storage: createJSONStorage(() => ({
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => quietly(() => window.localStorage.setItem(key, value)),
        removeItem: (key) => window.localStorage.removeItem(key),
      })),
    }
  )
);

// Another tab's change shows here, so this tab's next change does not write over it.
window.addEventListener("storage", (event) => {
  if (event.key === useUiPreferences.persist.getOptions().name) {
    void useUiPreferences.persist.rehydrate();
  }
});
