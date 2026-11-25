/**
 * What an overlay does to the global commands under it: a `passthrough` one lets them run, an
 * `alert-dialog` stops every one, and any other stops all but those that reach under all.
 */
export type OverlayKind = "passthrough" | "alert-dialog" | "overlay";

/** One open overlay of ours: the same object for as long as it is open. */
export interface OverlayLayer {
  readonly kind: OverlayKind;
}

/** The overlays that are over the page, bottom first, and when they may have changed. */
export interface LayerSource {
  get(): readonly OverlayLayer[];
  subscribe(listener: () => void): () => void;
}

/** An overlay with this attribute is `passthrough`, as the navigation drawer is. */
export const GLOBAL_KEYS_ATTRIBUTE = "data-global-keys";

/** The modal overlays of the UI package, by the `data-slot` of their popups. */
const MODAL_SLOTS = ["dialog-content", "alert-dialog-content", "sheet-content", "drawer-content"];

/** Its other overlays, which count while the focus is inside. A tooltip and a hover card are none. */
const FOCUSED_SLOTS = [
  "popover-content",
  "dropdown-menu-content",
  "dropdown-menu-sub-content",
  "context-menu-content",
  "select-content",
  "combobox-content",
];

const slots = (names: readonly string[], state = "") =>
  names.map((slot) => `[data-slot="${slot}"]${state}`).join(", ");

const POPUPS = slots([...MODAL_SLOTS, ...FOCUSED_SLOTS]);
/** A modal overlay's popup while it is open: Base UI sets `data-open` on it. */
const OPEN_MODALS = slots(MODAL_SLOTS, "[data-open]");

const layers = new WeakMap<Element, OverlayLayer>();

/**
 * The layer of an overlay's popup, or undefined for an element that is none. An overlay's own
 * context passes it to `useRegisterCommands`.
 */
export function overlayLayerOf(popup: Element): OverlayLayer | undefined {
  const known = layers.get(popup);
  if (known !== undefined) return known;
  if (!popup.matches(POPUPS)) return undefined;
  const kind = popup.hasAttribute(GLOBAL_KEYS_ATTRIBUTE)
    ? "passthrough"
    : popup.getAttribute("data-slot") === "alert-dialog-content"
      ? "alert-dialog"
      : "overlay";
  const layer: OverlayLayer = { kind };
  layers.set(popup, layer);
  return layer;
}

/** The overlays `element` is inside, outermost first; none for an element of the page. */
function overlaysAround(element: Element | null): OverlayLayer[] {
  const found: OverlayLayer[] = [];
  // An element taken out of the page is inside no overlay, whatever still names it as focused.
  if (element === null || !element.isConnected) return found;
  let popup = element.closest(POPUPS);
  while (popup !== null) {
    // Base UI marks a popup that is closing, which keeps the focus until its exit ends.
    const layer = popup.hasAttribute("data-closed") ? undefined : overlayLayerOf(popup);
    if (layer !== undefined) found.unshift(layer);
    popup = popup.parentElement?.closest(POPUPS) ?? null;
  }
  return found;
}

const EVENTS = ["focusin", "focusout"] as const;

/**
 * The overlays over the page, read from the DOM, bottom first: each open modal one, in the order
 * the page stacks them, then each other one the focus is inside, such as a menu or a popover. A
 * modal one counts from the moment it opens, a moment before it takes the focus.
 */
export const focusedOverlays: LayerSource = {
  get() {
    const modals = [...document.querySelectorAll(OPEN_MODALS)]
      .map(overlayLayerOf)
      .filter((layer) => layer !== undefined);
    const around = overlaysAround(document.activeElement);
    return [...modals, ...around.filter((layer) => !modals.includes(layer))];
  },
  subscribe(listener) {
    for (const event of EVENTS) document.addEventListener(event, listener, true);
    return () => {
      for (const event of EVENTS) document.removeEventListener(event, listener, true);
    };
  },
};
