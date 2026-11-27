import { useLiveViews } from "@upstream-dispatch/features/agent-view/live-views";
import { legacyPinnedIds, usePinnedAgents } from "@upstream-dispatch/features/agents/pins";
import { legacyPinnedAgentsKey } from "@upstream-dispatch/features/shell/userPreference";
import { useEffect, useRef } from "react";

export type PinWrite = (sessionId: string, pinned: boolean) => Promise<boolean>;

/** Tells the live-view registry the whole pinned set, which the sidebar may not be on screen to say. */
export function useLiveViewPins(): void {
  const liveViews = useLiveViews();
  const pinned = usePinnedAgents();
  useEffect(() => {
    liveViews.setPinned(pinned);
  }, [liveViews, pinned]);
}

/**
 * Moves the pins this browser kept for `login` to Dispatch, one write at a time, once. A refused
 * write stops the move and keeps the browser's list for the next load.
 */
export function usePinsMigration(login: string, writePin: PinWrite): void {
  const moving = useRef<string | null>(null);
  useEffect(() => {
    const key = legacyPinnedAgentsKey(login);
    if (moving.current === key) return;
    const kept = window.localStorage.getItem(key);
    if (kept === null) return;
    moving.current = key;
    void (async () => {
      for (const sessionId of legacyPinnedIds(kept)) {
        if (!(await writePin(sessionId, true))) return;
      }
      window.localStorage.removeItem(key);
    })();
  }, [login, writePin]);
}
