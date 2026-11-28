import { blockFragment, type EditorHandle, refocusWhenSettled } from "@/upstream/editor/frame";

/** The refocus of the last move, which a new move replaces, as upstream's navigator's does. */
let disposeRefocus: () => void = () => {};

/** Puts the focus on the host until it leaves: the host takes no focus of a click or a Tab. */
function focusHost(host: HTMLElement): void {
  if (document.activeElement === host) return;
  host.tabIndex = -1;
  host.addEventListener("blur", () => host.removeAttribute("tabindex"), { once: true });
  host.focus({ preventScroll: true });
}

/**
 * The aids' one move to a block: the handle's `focusBlock`, which opens its folds, again once the
 * layout settles, and the focus on the host element, so the next key acts too. A click also sets
 * the block's `#b-` anchor; a key leaves the address as it is.
 */
export function moveToBlock(
  target: { editor: EditorHandle; host: HTMLElement },
  blockId: string,
  by: "click" | "key"
): void {
  if (by === "click") window.location.hash = blockFragment(blockId);
  const focus = () => target.editor.focusBlock(blockId);
  disposeRefocus();
  focus();
  focusHost(target.host);
  disposeRefocus = refocusWhenSettled(focus, target.editor.view.dom);
}
