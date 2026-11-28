import { create } from "zustand";
import { persist } from "zustand/middleware";

import { browserStorage, followOtherTabs } from "./browser-kept";

/** What a person sets in the UI and expects after a reload: today, the sidebar's folded sections. */
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
    { name: "tl-dispatch.ui-preferences", version: 1, storage: browserStorage() }
  )
);

followOtherTabs(useUiPreferences);
