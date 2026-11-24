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

/** One open overlay. */
export interface OverlayLayer {
  readonly kind: OverlayKind;
  /** Removes this layer; a second call does nothing. */
  close(): void;
}

export interface OverlayLayers {
  open(kind: OverlayKind): OverlayLayer;
  /** The open layers, bottom first. */
  list(): readonly OverlayLayer[];
  subscribe(listener: () => void): () => void;
}

export function createOverlayLayers(): OverlayLayers {
  let layers: readonly OverlayLayer[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    open(kind) {
      const layer: OverlayLayer = {
        kind,
        close() {
          if (!layers.includes(layer)) return;
          layers = layers.filter((open) => open !== layer);
          notify();
        },
      };
      layers = [...layers, layer];
      notify();
      return layer;
    },
    list: () => layers,
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
