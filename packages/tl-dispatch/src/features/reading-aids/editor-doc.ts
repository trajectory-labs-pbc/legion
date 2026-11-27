import type { Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new WeakMap<EditorView, Set<() => void>>();

/** Tells the parts when the editor's document changes, by a local or a remote step. */
export function docChangesPlugin(): Plugin {
  return new Plugin({
    view: () => ({
      update: (view, previous) => {
        if (view.state.doc === previous.doc) return;
        for (const listener of listeners.get(view) ?? []) listener();
      },
    }),
  });
}

function useDocChanges(view: EditorView) {
  return useCallback(
    (listener: () => void) => {
      const own = listeners.get(view) ?? new Set();
      listeners.set(view, own.add(listener));
      return () => own.delete(listener);
    },
    [view]
  );
}

/** The editor's document, drawn again after each change of it. */
export function useEditorDoc(view: EditorView): Node {
  return useSyncExternalStore(useDocChanges(view), () => view.state.doc);
}

/** The blocks of `doc` whose ids are keys of `ids`, in the document's order. */
function blocksInOrder(doc: Node, ids: ReadonlyMap<string, unknown>): string[] {
  const found: string[] = [];
  doc.descendants((node) => {
    const id: unknown = node.attrs.blockId;
    if (typeof id === "string" && ids.has(id) && !found.includes(id)) found.push(id);
    // A textblock's inline children carry no block id.
    return !node.isTextblock;
  });
  return found;
}

/** Of the keys of `ids`, the blocks the editor's document holds, in its order; drawn again only
 *  when that changes. */
export function useBlocksInOrder(
  view: EditorView,
  ids: ReadonlyMap<string, unknown>
): readonly string[] {
  // Joined, so the store's snapshot compares equal while the order stays.
  const shown = useSyncExternalStore(useDocChanges(view), () =>
    blocksInOrder(view.state.doc, ids).join("\n")
  );
  return useMemo(() => (shown === "" ? [] : shown.split("\n")), [shown]);
}
