// The aids' unit tests' editors: upstream's options, a root inside given elements, and two
// documents that relay their updates.
import type { EditorView } from "@milkdown/kit/prose/view";
import type { EditorHandle, EditorOptions } from "@upstream-dispatch/features/doc/editor";
import { compiledBlockSchema } from "@upstream-dispatch/features/doc/schema";
import * as Y from "yjs";

import { createAidedEditor } from "./aided-editor";
import { FOLDED_CLASS } from "./folds";

export const SPEC = "dispatch://CORE-1/spec";

const handles: EditorHandle[] = [];

/** Destroys each editor `editorIn` made and empties the document; a test file's `afterEach`. */
export async function destroyEditors(): Promise<void> {
  await Promise.all(handles.splice(0).map((handle) => handle.destroy()));
  document.body.replaceChildren();
}

/** Upstream's editor options for `ydoc`, naming `documentRef`. */
export function options(ydoc: Y.Doc, documentRef: string | undefined): EditorOptions {
  return {
    awareness: null,
    blockSchema: compiledBlockSchema,
    documentRef,
    onAskBlockHosts: () => {},
    user: { color: "#f59e0b", name: "alice" },
    watchPicture: () => () => {},
    ydoc,
  };
}

/** An element under `document.body`, inside the elements `around` names, outermost first. */
export function rootIn(...around: string[]): HTMLElement {
  let parent: HTMLElement = document.body;
  for (const attribute of around) {
    const element = parent.appendChild(document.createElement("div"));
    element.setAttribute(attribute, "");
    parent = element;
  }
  return parent.appendChild(document.createElement("div"));
}

/** An aided editor in `root`, which `destroyEditors` destroys. */
export async function editorIn(
  root: HTMLElement,
  documentRef: string | undefined,
  ydoc = new Y.Doc()
): Promise<EditorHandle> {
  return keep(await createAidedEditor(root, options(ydoc, documentRef)));
}

/** The block ids of `view`'s document, in its order. */
export function blockIdsOf(view: EditorView): string[] {
  const ids: string[] = [];
  view.state.doc.descendants((node) => {
    if (typeof node.attrs.blockId === "string") ids.push(node.attrs.blockId);
  });
  return ids;
}

/** The position of the block `blockId` in `view`'s document. */
export function positionOf(view: EditorView, blockId: string): number {
  let found: number | undefined;
  view.state.doc.descendants((node, pos) => {
    if (found === undefined && node.attrs.blockId === blockId) found = pos;
    return found === undefined;
  });
  if (found === undefined) throw new Error(`the document has no block ${blockId}`);
  return found;
}

/** The ids of the blocks `view` draws folded, in document order. */
export const foldedIdsOf = (view: EditorView) =>
  [...view.dom.querySelectorAll(`.${FOLDED_CLASS}`)].map((element) =>
    element.getAttribute("data-block-id")
  );

// Above the fixed refs the tests name, such as CORE-1 and CORE-7.
let documents = 100;

/** The address of a document no other editor of the run names. */
export const newDocumentRef = () => `dispatch://CORE-${++documents}/spec`;

/** Keeps `handle` for `destroyEditors`. */
export function keep(handle: EditorHandle): EditorHandle {
  handles.push(handle);
  return handle;
}

/** Two documents relaying every update to each other, as the room relays one browser's. */
export function linkedDocs(): { browser: Y.Doc; peer: Y.Doc } {
  const browser = new Y.Doc();
  const peer = new Y.Doc();
  for (const [from, to] of [
    [peer, browser],
    [browser, peer],
  ] as const) {
    from.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== "relay") Y.applyUpdate(to, update, "relay");
    });
  }
  return { browser, peer };
}
