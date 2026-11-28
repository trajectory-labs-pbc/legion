// An aid's tie to the visit: its object for each editor, each document's last visit part, and the reset a forget runs.
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

import { onForget } from "./visit";

export interface VisitWiring<Part, Aid> {
  /** The aid of `view`. */
  of(view: EditorView): Aid;
  /** The part a new editor of `documentRef` starts from: the last one attached, if any. */
  start(documentRef: string): Part | undefined;
  /** Records `part` as the last attached of `documentRef`. */
  attached(documentRef: string, part: Part): void;
  /** Keeps `aid` for `view`, whose `reset` runs at each forget until the editor ends, which the plugin tells. */
  add(view: EditorView, aid: Aid, reset: () => void): Plugin;
}

/** The wiring of one aid, `name` in its errors. */
export function visitWiring<Part, Aid>(name: string): VisitWiring<Part, Aid> {
  const byView = new WeakMap<EditorView, Aid>();
  const byDocument = new Map<string, Part>();
  const resets = new Map<EditorView, () => void>();
  // A forgotten visit's parts end in every live editor; a drawn part then attaches the new visit.
  onForget(() => {
    byDocument.clear();
    for (const reset of resets.values()) reset();
  });
  const key = new PluginKey("reading-aids-visit");
  return {
    of: (view) => {
      const aid = byView.get(view);
      if (aid === undefined) throw new Error(`the editor has no ${name}`);
      return aid;
    },
    start: () => undefined,
    attached: (documentRef, part) => {
      byDocument.set(documentRef, part);
    },
    add: (view, aid, reset) => {
      byView.set(view, aid);
      resets.set(view, reset);
      return new Plugin({
        key,
        // A reconfigure also destroys a plugin's view, so only the editor's end, or the aids', drops the reset.
        view: () => ({
          destroy: () =>
            queueMicrotask(() => {
              if (view.isDestroyed || key.get(view.state) === undefined) resets.delete(view);
            }),
        }),
      });
    },
  };
}
