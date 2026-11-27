import type { Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { useCallback, useSyncExternalStore } from "react";

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

/** The editor's document, drawn again after each change of it. */
export function useEditorDoc(view: EditorView): Node {
  const subscribe = useCallback(
    (listener: () => void) => {
      const own = listeners.get(view) ?? new Set();
      listeners.set(view, own.add(listener));
      return () => own.delete(listener);
    },
    [view]
  );
  return useSyncExternalStore(subscribe, () => view.state.doc);
}
