import { afterEach, beforeAll, expect, test } from "bun:test";
import { Plugin } from "@milkdown/kit/prose/state";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import type { ReactNode } from "react";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { HOST_ATTRIBUTE } from "./aided-editor";
import { blockFoldsOf } from "./block-folds";
import { useBlockFolds } from "./block-folds-part";
import { against, inProcessEditorIn } from "./comparer-fixtures";
import { destroyEditors, editorIn, foldedIdsOf, newDocumentRef, rootIn } from "./editor-fixtures";
import { type PartsEntry, partsSlot } from "./parts-slot";
import type { Baseline } from "./use-baseline";
import { useChangeMarks } from "./use-change-marks";
import { recordReadMarks, visitOf } from "./visit";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(async () => {
  cleanup();
  await destroyEditors();
});

const MARKDOWN = [
  ":::requirement{#r1}",
  "**R1.** The requirement.",
  ":::",
  "",
  ":::plan_task{#t1}",
  "**T1.** The task.",
  ":::",
  "",
  "A closing paragraph, where the caret is.",
  "",
].join("\n");

/** An aided editor of the document `documentRef`, made by `make`, its caret after the last fold. */
async function aided(
  documentRef: string,
  make: (root: HTMLElement, documentRef: string) => Promise<EditorHandle> = editorIn
): Promise<EditorHandle> {
  const handle = await make(rootIn(HOST_ATTRIBUTE), documentRef);
  handle.setMarkdown(MARKDOWN);
  return handle;
}

const folded = (handle: EditorHandle) => foldedIdsOf(handle.view);

function entryOf(handle: EditorHandle): PartsEntry {
  const entry = partsSlot.entries().find((each) => each.editor === handle);
  if (entry === undefined) throw new Error("the editor got no aids");
  return entry;
}

const page = ({ children }: { children: ReactNode }) => (
  <MemoryNavigationProvider path="/issues/CORE-7/spec">{children}</MemoryNavigationProvider>
);

/** A page whose person, alice, the visits are kept for, with a document of its own. */
function signedIn() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["whoami"], { login: "alice" });
  const stop = recordReadMarks(queryClient);
  const documentRef = newDocumentRef();
  return {
    artifactId: `the artifact of ${documentRef}`,
    documentRef,
    signOut: () => writesOf(queryClient).signedOut("alice"),
    stop,
  };
}

test("a sign-out takes the person's fold choices from the open editor", async () => {
  const { artifactId, documentRef, signOut, stop } = signedIn();
  const handle = await aided(documentRef);
  const entry = entryOf(handle);
  renderHook(() => useBlockFolds(entry, artifactId), { wrapper: page });
  expect(folded(handle)).toEqual(["r1", "t1"]);
  act(() => blockFoldsOf(handle.view).toggle("t1"));
  expect(folded(handle)).toEqual(["r1"]);

  act(signOut);
  expect(folded(handle)).toEqual(["r1", "t1"]);
  stop();
});

test("a sign-out takes the person's fold choices from the next editor of a document no editor showed", async () => {
  const { artifactId, documentRef, signOut, stop } = signedIn();
  const first = await aided(documentRef);
  blockFoldsOf(first.view).attach(visitOf(artifactId).blockFolds);
  blockFoldsOf(first.view).toggle("t1");
  await first.destroy();

  signOut();
  expect(folded(await aided(documentRef))).toEqual(["r1", "t1"]);
  stop();
});

test("a sign-out takes the person's fold choices from an editor whose document was not known yet", async () => {
  const { artifactId, documentRef, signOut, stop } = signedIn();
  const handle = await aided(documentRef);
  blockFoldsOf(handle.view).toggle("t1");
  expect(folded(handle)).toEqual(["r1"]);

  signOut();
  expect(folded(handle)).toEqual(["r1", "t1"]);
  blockFoldsOf(handle.view).attach(visitOf(artifactId).blockFolds);
  expect(folded(handle)).toEqual(["r1", "t1"]);
  stop();
});

/** Gives the editor one more plugin, as upstream's collaboration cursor does after it is made. */
async function reconfigure(handle: EditorHandle): Promise<void> {
  const { view } = handle;
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, new Plugin({})] }));
  await Promise.resolve();
}

test("a sign-out takes the person's fold choices from an editor whose plugins changed before its document was known", async () => {
  const { documentRef, signOut, stop } = signedIn();
  const handle = await aided(documentRef);
  blockFoldsOf(handle.view).toggle("t1");
  await reconfigure(handle);

  signOut();
  expect(folded(handle)).toEqual(["r1", "t1"]);
  stop();
});

test("a choice made before the document was known joins the visit after the editor's plugins changed", async () => {
  const { artifactId, documentRef, stop } = signedIn();
  const handle = await aided(documentRef);
  blockFoldsOf(handle.view).toggle("t1");
  await reconfigure(handle);

  blockFoldsOf(handle.view).attach(visitOf(artifactId).blockFolds);
  expect(folded(handle)).toEqual(["r1"]);
  expect(visitOf(artifactId).blockFolds.choices.get("t1")).toBe(true);
  stop();
});

/** The baseline's text: the document with `from` reading `to`. */
const textWith = (from: string, to: string): ChangeBaseline => ({
  markdown: MARKDOWN.replace(from, to),
  tree: undefined,
});

/** A ready baseline of `text`: a new object at each call, as each visit's is, of one choice. */
const readyWith = (text: ChangeBaseline): Baseline => ({ ...against(text), state: "ready" });

/** A signed-in page whose editor's folds and marks follow the parts' hooks, compared with `text`. */
async function markedPage(text: ChangeBaseline) {
  const signed = signedIn();
  const handle = await aided(signed.documentRef, inProcessEditorIn);
  const entry = entryOf(handle);
  const { rerender } = renderHook(
    ({ shown }: { shown: Baseline }) => {
      useBlockFolds(entry, signed.artifactId);
      useChangeMarks(handle.view, shown);
    },
    { initialProps: { shown: readyWith(text) }, wrapper: page }
  );
  await waitFor(() => expect(folded(handle)).toEqual(["r1"]));
  return { ...signed, handle, rerender };
}

test("after a sign-out with the marks drawn, the next person's visit opens the blocks the marks show changed", async () => {
  const text = textWith("The task.", "The task, as planned.");
  const { artifactId, handle, rerender, signOut, stop } = await markedPage(text);
  act(signOut);
  expect(folded(handle)).toEqual(["r1", "t1"]);
  // The page reads the cached text again, so the marks compare nothing anew for the next visit.
  rerender({ shown: readyWith(text) });
  await waitFor(() => expect(folded(handle)).toEqual(["r1"]));
  expect([...(visitOf(artifactId).blockFolds.touched ?? [])]).toEqual(["t1"]);
  stop();
});

test("after a sign-out, a next person's page with no baseline holds no block open, so each block folds", async () => {
  const { artifactId, handle, rerender, signOut, stop } = await markedPage(
    textWith("The task.", "The task, as planned.")
  );
  act(signOut);
  rerender({ shown: { state: "none" } });
  await waitFor(() => expect(folded(handle)).toEqual(["r1", "t1"]));
  expect(visitOf(artifactId).blockFolds.touched).toBeUndefined();
  stop();
});

test("after a sign-out, a next person's baseline of another text opens the blocks its own comparison changed", async () => {
  const { handle, rerender, signOut, stop } = await markedPage(
    textWith("The task.", "The task, as planned.")
  );
  act(signOut);
  rerender({ shown: readyWith(textWith("The requirement.", "The requirement, as it was.")) });
  await waitFor(() => expect(folded(handle)).toEqual(["t1"]));
  stop();
});
