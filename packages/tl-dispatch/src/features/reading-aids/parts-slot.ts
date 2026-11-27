import type { ConnectDocument } from "@upstream-dispatch/features/doc/connection";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";
import { type ComponentType, useMemo, useSyncExternalStore } from "react";

/** One aided editor's parts root, which its host draws the parts into. */
export interface PartsEntry {
  /** Stable for the entry, so its portal keeps its tree. */
  readonly key: string;
  /** The widget's root, at the start of the editor's document. */
  readonly root: HTMLElement;
  /** The host element the editor is drawn in. */
  readonly host: HTMLElement;
  /** The wrapped handle of the editor. */
  readonly editor: EditorHandle;
  /** The open document's reference, as the editor's options name it. */
  readonly documentRef: string;
  /** The parts, which load with the aids' plugins, not with the host. */
  readonly Parts: ComponentType<PartsProps>;
}

export interface PartsProps {
  readonly entry: PartsEntry;
  /** Whether its editor is the one the reader sees, whose parts hold the aids' keys. */
  readonly shown: boolean;
}

let entries: readonly PartsEntry[] = [];
let added = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function publish(next: readonly PartsEntry[]): void {
  entries = next;
  notify();
}

/** The parts roots of every aided editor, which hosts read. */
export const partsSlot = {
  add(entry: Omit<PartsEntry, "key">): void {
    added += 1;
    publish([...entries, { ...entry, key: `${added}` }]);
  },
  /** Removes the entry of `root`, as its widget goes. */
  remove(root: HTMLElement): void {
    const kept = entries.filter((entry) => entry.root !== root);
    if (kept.length !== entries.length) publish(kept);
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  entries: (): readonly PartsEntry[] => entries,
};

/** The parts roots of the editors drawn in `host`. */
export function usePartsOf(host: HTMLElement | null): readonly PartsEntry[] {
  const all = useSyncExternalStore(partsSlot.subscribe, partsSlot.entries);
  return useMemo(() => all.filter((entry) => entry.host === host), [all, host]);
}

const synced = new Map<string, boolean>();

function setSynced(artifactId: string, value: boolean): void {
  synced.set(artifactId, value);
  notify();
}

/** Upstream's connect, which also tells the parts when a document's first sync completes. */
export const reportingSync =
  (connect: ConnectDocument): ConnectDocument =>
  (artifactId, callbacks) => {
    setSynced(artifactId, false);
    return connect(artifactId, {
      ...callbacks,
      onSynced() {
        setSynced(artifactId, true);
        callbacks.onSynced();
      },
    });
  };

/** Whether the server's first sync of the document has completed on its latest connection. */
export const useSynced = (artifactId: string): boolean =>
  useSyncExternalStore(partsSlot.subscribe, () => synced.get(artifactId) === true);
