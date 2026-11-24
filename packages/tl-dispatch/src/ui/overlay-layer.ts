/** The kinds of overlay that take a layer. A hover card takes none. */
export type OverlayKind =
  | "dialog"
  | "alert-dialog"
  | "sheet"
  | "drawer"
  | "menu"
  | "context-menu"
  | "popover"
  | "select";

export interface OverlayLayers {
  /** Adds a layer of `kind`; the returned function removes that layer. */
  open(kind: OverlayKind): () => void;
  top(): OverlayKind | undefined;
  depth(): number;
  subscribe(listener: () => void): () => void;
}

export function createOverlayLayers(): OverlayLayers {
  const layers: { kind: OverlayKind }[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    open(kind) {
      const layer = { kind };
      layers.push(layer);
      notify();
      return () => {
        const index = layers.indexOf(layer);
        if (index === -1) return;
        layers.splice(index, 1);
        notify();
      };
    },
    top: () => layers.at(-1)?.kind,
    depth: () => layers.length,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's layers: every overlay component opens one while it is open. */
export const overlayLayers = createOverlayLayers();
