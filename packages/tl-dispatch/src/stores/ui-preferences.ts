import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * What a person sets in the UI and expects after a reload: today, the sidebar's folded sections.
 *
 * A change to the stored shape bumps `version` and adds a `migrate` from the older one. That
 * `migrate` throws for a newer version: `persist` would write its result back, and two tabs on two
 * builds would then rewrite the key without end. With no `migrate`, a newer version is left alone.
 */
interface UiPreferences {
  /** Whether each sidebar section is folded, by its heading; a missing heading is open. */
  sidebarFolds: Readonly<Record<string, boolean>>;
  setSidebarFold: (heading: string, folded: boolean) => void;
}

export const useUiPreferences = create<UiPreferences>()(
  persist(
    (set) => ({
      sidebarFolds: {},
      setSidebarFold: (heading, folded) =>
        set((s) =>
          s.sidebarFolds[heading] === folded
            ? s
            : { sidebarFolds: { ...s.sidebarFolds, [heading]: folded } }
        ),
    }),
    {
      name: "tl-dispatch.ui-preferences",
      version: 1,
      partialize: ({ sidebarFolds }) => ({ sidebarFolds }),
    }
  )
);

// Another tab's change shows here, so two tabs never write over each other's preferences.
window.addEventListener("storage", (event) => {
  if (event.key === useUiPreferences.persist.getOptions().name) {
    void useUiPreferences.persist.rehydrate();
  }
});
