import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";

const MODAL_KINDS = ["alert-dialog", "dialog", "drawer", "sheet"] as const;

/** An overlay with a scrim. Its content uses `useModalLayer`. */
export type ModalKind = (typeof MODAL_KINDS)[number];

/** An overlay with no scrim. Its content uses `OverlayLayerProvider`. */
export type PopupKind = "menu" | "popover" | "select";

export type OverlayKind = ModalKind | PopupKind;

/** One open overlay. A command registry reads the stack to know which keys may run. */
export interface OverlayLayer {
  readonly kind: OverlayKind;
  /** The overlay that holds this one in the React tree. */
  readonly parent: OverlayLayer | null;
}

function isInside(layer: OverlayLayer, ancestor: OverlayLayer): boolean {
  for (let p = layer.parent; p !== null; p = p.parent) {
    if (p === ancestor) return true;
  }
  return false;
}

// Nested overlays that mount together push the inner one first (child effects run first), so a
// layer goes under the layers inside it.
function push(layers: readonly OverlayLayer[], layer: OverlayLayer): readonly OverlayLayer[] {
  const index = layers.findIndex(other => isInside(other, layer));
  if (index === -1) return [...layers, layer];
  return [...layers.slice(0, index), layer, ...layers.slice(index)];
}

type Listener = () => void;

/** The open overlays, bottom first: the one that opened last is on top. */
export const overlayStack = (() => {
  let layers: readonly OverlayLayer[] = [];
  const listeners = new Set<Listener>();
  return {
    get: (): readonly OverlayLayer[] => layers,
    set: (next: (current: readonly OverlayLayer[]) => readonly OverlayLayer[]): void => {
      layers = next(layers);
      for (const listener of listeners) listener();
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

function useOverlayStack<T>(select: (layers: readonly OverlayLayer[]) => T): T {
  return useSyncExternalStore(
    overlayStack.subscribe,
    () => select(overlayStack.get()),
    () => select([]),
  );
}

const OverlayLayerContext = createContext<OverlayLayer | null>(null);

// The root's open state. Base UI keeps a popup mounted while it animates out, so the layer follows
// this state rather than the mount.
const OverlayOpenContext = createContext<boolean | null>(null);

function useRootOpen(): boolean {
  const open = useContext(OverlayOpenContext);
  if (open === null) {
    throw new Error("An overlay's content must be inside OverlayOpenProvider");
  }
  return open;
}

interface OpenChangeDetails {
  readonly isCanceled: boolean;
}

interface OverlayOpenProps<Details extends OpenChangeDetails> {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean, details: Details) => void) | undefined;
}

/**
 * The open state of an overlay root, for `OverlayOpenProvider`. The root spreads `rootProps` on
 * Base UI, so it stays uncontrolled unless the caller controls it.
 */
export function useOverlayOpen<Details extends OpenChangeDetails>({
  open,
  defaultOpen = false,
  onOpenChange,
}: OverlayOpenProps<Details>): {
  open: boolean;
  rootProps: {
    open?: boolean;
    defaultOpen: boolean;
    onOpenChange: (open: boolean, details: Details) => void;
  };
} {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  return {
    open: open ?? uncontrolledOpen,
    rootProps: {
      ...(open === undefined ? {} : { open }),
      defaultOpen,
      onOpenChange: (next, details) => {
        onOpenChange?.(next, details);
        if (!details.isCanceled) setUncontrolledOpen(next);
      },
    },
  };
}

export function OverlayOpenProvider({ open, children }: { open: boolean; children: ReactNode }) {
  return <OverlayOpenContext.Provider value={open}>{children}</OverlayOpenContext.Provider>;
}

function useOpenLayer(kind: OverlayKind, open: boolean): OverlayLayer {
  const parent = useContext(OverlayLayerContext);
  const [layer] = useState<OverlayLayer>(() => ({ kind, parent }));
  useEffect(() => {
    if (!open) return;
    overlayStack.set(layers => push(layers, layer));
    return () => {
      overlayStack.set(layers => layers.filter(other => other !== layer));
    };
  }, [layer, open]);
  return layer;
}

/** Mount it in the content of a menu, a popover or a select. */
export function OverlayLayerProvider({ kind, children }: { kind: PopupKind; children: ReactNode }) {
  const layer = useOpenLayer(kind, useRootOpen());
  return <OverlayLayerScope layer={layer}>{children}</OverlayLayerScope>;
}

/** Mount it in the content of a modal layer, with the layer `useModalLayer` returns. */
export function OverlayLayerScope({ layer, children }: { layer: OverlayLayer; children: ReactNode }) {
  return <OverlayLayerContext.Provider value={layer}>{children}</OverlayLayerContext.Provider>;
}

const MODAL_KIND_SET: ReadonlySet<OverlayKind> = new Set(MODAL_KINDS);

function modalLayers(layers: readonly OverlayLayer[]): readonly OverlayLayer[] {
  return layers.filter(layer => MODAL_KIND_SET.has(layer.kind));
}

// A closing layer leaves the stack at once but animates out with the look it had.
function useKeptWhileClosed(open: boolean, live: boolean): boolean {
  const [kept, setKept] = useState(live);
  if (open && kept !== live) setKept(live);
  return open ? live : kept;
}

export interface ModalLayer {
  /** Give it to `OverlayLayerScope` around the content. */
  readonly layer: OverlayLayer;
  /** A modal layer is open below, whose scrim already dims the page. */
  readonly backdropProps: { readonly "data-stacked"?: true };
  /** A modal layer is open above, so this popup dims. */
  readonly popupProps: { readonly "data-covered"?: true };
}

/** One scrim dims the page, under the bottom modal layer. */
export function useModalLayer(kind: ModalKind): ModalLayer {
  const open = useRootOpen();
  const layer = useOpenLayer(kind, open);
  const stacked = useKeptWhileClosed(
    open,
    useOverlayStack(layers => {
      const modals = modalLayers(layers);
      const index = modals.indexOf(layer);
      return index === -1 ? modals.length > 0 : index > 0;
    }),
  );
  const covered = useKeptWhileClosed(
    open,
    useOverlayStack(layers => {
      const modals = modalLayers(layers);
      const index = modals.indexOf(layer);
      return index !== -1 && index < modals.length - 1;
    }),
  );
  return {
    layer,
    backdropProps: stacked ? { "data-stacked": true } : {},
    popupProps: covered ? { "data-covered": true } : {},
  };
}

/** The overlay that holds the caller, or `null` outside every overlay. */
export function useOverlayLayer(): OverlayLayer | null {
  return useContext(OverlayLayerContext);
}

/** The overlay under the one that holds the caller; outside every overlay, the top overlay. */
export function useOverlayBelow(): OverlayLayer | undefined {
  const own = useOverlayLayer();
  return useOverlayStack(layers => {
    const index = own === null ? -1 : layers.indexOf(own);
    return index === -1 ? layers.at(-1) : layers[index - 1];
  });
}

/** Class names for a modal backdrop: the scrim, hidden when another modal's scrim is below. */
export const scrimClass =
  "fixed inset-0 z-50 bg-scrim/50 transition-opacity duration-200 data-[stacked]:bg-transparent data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none";

/** Class names for a modal popup that dims while another modal covers it. */
export const coveredClass =
  "after:pointer-events-none after:absolute after:inset-0 after:bg-scrim after:opacity-0 after:transition-opacity data-[covered]:after:opacity-25";
