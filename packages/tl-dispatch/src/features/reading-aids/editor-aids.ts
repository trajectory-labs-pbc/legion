// The aids' plugins and parts, which load behind the `import()` of the aided editor.
import "./aids.css";

import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";

import { AidParts } from "./aid-parts";
import { blockFoldsOf, blockFoldsPlugins } from "./block-folds";
import type { Comparer } from "./comparer";
import { docChangesPlugin } from "./editor-doc";
import { changedBlocks, changeMarksPlugin, watchChanges } from "./marks-plugin";
import { onlyChangesPlugins } from "./only-changes";
import { partsSlot } from "./parts-slot";

/** The key of the parts plugin, whose state is the parts' height: an editor that holds it has the aids. */
const aidsKey = new PluginKey<number>("reading-aids");

export const PARTS_ATTRIBUTE = "data-reading-aids-parts";

export { revealBlock } from "./folds";
export { besideChangeMarks, showsChangeMarks, watchChanges } from "./marks-plugin";

/** The parts' root: outside the text, not editable, and found by no block or mark lookup. */
function partsRoot(): HTMLElement {
  const root = document.createElement("div");
  // The editor typography skips the parts, as it skips upstream slots in the editor.
  root.className = "reading-aids-parts not-prose";
  root.setAttribute(PARTS_ATTRIBUTE, "");
  root.setAttribute("contenteditable", "false");
  root.tabIndex = -1;
  return root;
}

const heightWatches = new WeakMap<HTMLElement, ResizeObserver>();

/** Keeps the parts' height, margin included, in the plugin's state as it changes. */
function watchHeight(view: EditorView, root: HTMLElement): void {
  const watch = new ResizeObserver(() => {
    if (view.isDestroyed) return;
    const height =
      root.offsetHeight + (Number.parseFloat(getComputedStyle(root).marginBlockEnd) || 0);
    if (height === aidsKey.getState(view.state)) return;
    view.dispatch(view.state.tr.setMeta(aidsKey, height));
  });
  watch.observe(root);
  heightWatches.set(root, watch);
}

/**
 * The plugin that draws the parts' root at the start of the document. Upstream's editable has a
 * minimum height (`least`, read from it) and re-places its counters only when its box changes, so
 * the parts add their height to that minimum: parts that grow in a short document move them too.
 */
function partsPlugin(
  host: HTMLElement,
  editor: EditorHandle,
  documentRef: string,
  least: number
): Plugin<number> {
  const widget = Decoration.widget(
    0,
    (view) => {
      const root = partsRoot();
      partsSlot.add({ Parts: AidParts, documentRef, editor, host, root });
      watchHeight(view, root);
      return root;
    },
    {
      destroy: (node) => {
        if (!(node instanceof HTMLElement)) return;
        heightWatches.get(node)?.disconnect();
        partsSlot.remove(node);
      },
      ignoreSelection: true,
      key: "reading-aids-parts",
      side: -1,
      stopEvent: () => true,
    }
  );
  return new Plugin({
    key: aidsKey,
    state: {
      init: () => 0,
      apply: (transaction, height) => {
        const next: unknown = transaction.getMeta(aidsKey);
        return typeof next === "number" ? next : height;
      },
    },
    props: {
      attributes: (state): Record<string, string> => {
        const height = aidsKey.getState(state) ?? 0;
        return height > 0 && least > 0 ? { style: `min-height: ${least + height}px` } : {};
      },
      decorations: (state) => DecorationSet.create(state.doc, [widget]),
    },
  });
}

/** Adds the aids to an editor that has none; `startComparer` makes the change marks' comparer. */
export function installAids(
  editor: EditorHandle,
  host: HTMLElement,
  documentRef: string,
  startComparer?: () => Comparer
): void {
  const { view } = editor;
  if (aidsKey.get(view.state) !== undefined) throw new Error("This editor has the aids already.");
  const least = Number.parseFloat(getComputedStyle(view.dom).minHeight) || 0;
  const aids = [
    partsPlugin(host, editor, documentRef, least),
    docChangesPlugin(),
    changeMarksPlugin(startComparer),
    ...blockFoldsPlugins(view, documentRef),
    ...onlyChangesPlugins(editor, host, documentRef),
  ];
  view.updateState(view.state.reconfigure({ plugins: view.state.plugins.concat(aids) }));
  // The blocks the first comparison draws as changed start open.
  const folds = blockFoldsOf(view);
  watchChanges(view, () => {
    const changed = changedBlocks(view);
    if (changed !== undefined) folds.setTouched(changed);
  });
}
