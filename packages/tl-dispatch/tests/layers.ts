import type { LayerSource, OverlayKind, OverlayLayer } from "@/commands/focused-overlay";

export interface OpenLayer extends OverlayLayer {
  close(): void;
}

/** A stack of overlays that hold the focus, for one test, in place of the document's. */
export function createLayerSource(): LayerSource & { open(kind: OverlayKind): OpenLayer } {
  let layers: readonly OverlayLayer[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly OverlayLayer[]) => {
    layers = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => layers,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    open(kind) {
      const layer: OpenLayer = {
        kind,
        close: () => set(layers.filter((other) => other !== layer)),
      };
      set([...layers, layer]);
      return layer;
    },
  };
}

const SLOT_OF_KIND: Readonly<Record<OverlayKind, string>> = {
  dialog: "dialog-content",
  "alert-dialog": "alert-dialog-content",
  // Not `sheet-content`, which a test reads to find the app's own sheet.
  sheet: "drawer-content",
  drawer: "drawer-content",
  menu: "dropdown-menu-content",
  popover: "popover-content",
  select: "select-content",
};

/**
 * Opens an overlay in the document as the UI package draws one: an open popup with its
 * `data-slot` that holds the focus. `close` removes it and puts the focus back where it was.
 */
export function openAppLayer(kind: OverlayKind): { close(): void } {
  const before = document.activeElement;
  const popup = document.createElement("div");
  popup.setAttribute("data-slot", SLOT_OF_KIND[kind]);
  popup.setAttribute("data-open", "");
  if (kind === "drawer") popup.setAttribute("data-global-keys", "");
  popup.tabIndex = -1;
  document.body.append(popup);
  popup.focus();
  return {
    close() {
      popup.remove();
      if (before instanceof HTMLElement) before.focus();
      document.dispatchEvent(new FocusEvent("focusin"));
    },
  };
}
