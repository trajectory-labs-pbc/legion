import type { LayerSource } from "@/commands/engine";
import { type OverlayKind, type OverlayLayer, overlayStack } from "@/ui/overlay-layer";

export interface OpenLayer extends OverlayLayer {
  close(): void;
}

/** A stack of open overlays for one test, as the registry's overlay stack holds them. */
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
        parent: null,
        close: () => set(layers.filter((other) => other !== layer)),
      };
      set([...layers, layer]);
      return layer;
    },
  };
}

/** Opens a layer on the app's overlay stack, as a registry overlay's content does. */
export function openAppLayer(kind: OverlayKind): OpenLayer {
  const layer: OpenLayer = {
    kind,
    parent: null,
    close: () => overlayStack.set((layers) => layers.filter((other) => other !== layer)),
  };
  overlayStack.set((layers) => [...layers, layer]);
  return layer;
}
