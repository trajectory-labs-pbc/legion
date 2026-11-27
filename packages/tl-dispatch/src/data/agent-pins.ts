import { useEffect, useRef } from "react";
import { upstreamKeys } from "@/browser/storage";
import {
  legacyPinnedIds,
  useAgentPinWrite,
  useAgentText,
  useLiveViewState,
  useLiveViews,
  usePinnedAgents,
} from "@/upstream/data-hooks";

export {
  totalUnreadReplies,
  unreadRepliesLabel,
  useAgentPinWrite,
} from "@/upstream/data-hooks";

export type PinWrite = (sessionId: string, pinned: boolean) => Promise<boolean>;

/** Tells the live-view registry the whole pinned set, which the sidebar may not be on screen to say. */
export function useLiveViewPins(): void {
  const liveViews = useLiveViews();
  const pinned = usePinnedAgents();
  useEffect(() => {
    liveViews.setPinned(pinned);
  }, [liveViews, pinned]);
}

/** A pinned agent's name, its live view's state, and the way to unpin it. */
export function usePinnedAgent(sessionId: string): {
  name: string;
  viewState: ReturnType<typeof useLiveViewState>;
  unpin: () => void;
} {
  const name = useAgentText().sessionText(sessionId, undefined);
  const viewState = useLiveViewState(sessionId);
  const writePin = useAgentPinWrite();
  return { name, viewState, unpin: () => writePin(sessionId, false) };
}

/**
 * Moves the pins this browser kept for `login` to Dispatch, one write at a time, once. A refused
 * write stops the move and keeps the browser's list for the next load.
 */
export function usePinsMigration(login: string, writePin: PinWrite): void {
  const moving = useRef<string | null>(null);
  useEffect(() => {
    const pins = upstreamKeys.legacyPinnedAgents;
    const key = pins.name(login);
    if (moving.current === key) return;
    const kept = pins.get(login);
    if (kept === undefined) return;
    moving.current = key;
    void (async () => {
      for (const sessionId of legacyPinnedIds(kept)) {
        if (!(await writePin(sessionId, true))) return;
      }
      pins.remove(login);
    })();
  }, [login, writePin]);
}
