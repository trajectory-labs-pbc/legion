import { create } from "zustand";
import { persist } from "zustand/middleware";

import { browserStorage, followOtherTabs } from "./browser-kept";

/**
 * Whether this browser shows the new Inbox in place of upstream's, until the Inbox's last pull
 * request deletes this store and its key is read no more (R16).
 */
interface InboxPreview {
  on: boolean;
  turn: (on: boolean) => void;
}

export const useInboxPreview = create<InboxPreview>()(
  persist((set) => ({ on: false, turn: (on) => set({ on }) }), {
    name: "tl-dispatch.inbox-preview",
    version: 1,
    storage: browserStorage(),
    partialize: ({ on }) => ({ on }),
  })
);

followOtherTabs(useInboxPreview);
