// The parts' height on the editable's minimum height, written to the element itself.
import type { EditorView } from "@milkdown/kit/prose/view";

const stops = new WeakMap<HTMLElement, () => void>();

/** Keeps the editable's min-height at `least` plus the parts' height, outside ProseMirror. */
export function watchHeight(view: EditorView, root: HTMLElement, least: number): void {
  if (least <= 0) return;
  const watch = new ResizeObserver(() => {
    if (view.isDestroyed) return;
    const height =
      root.offsetHeight + (Number.parseFloat(getComputedStyle(root).marginBlockEnd) || 0);
    view.dom.style.minHeight = height > 0 ? `${least + height}px` : "";
  });
  watch.observe(root);
  stops.set(root, () => {
    watch.disconnect();
    view.dom.style.minHeight = "";
  });
}

/** Stops the watch of `root`'s height and gives the editable back upstream's minimum height. */
export function unwatchHeight(root: HTMLElement): void {
  stops.get(root)?.();
  stops.delete(root);
}
