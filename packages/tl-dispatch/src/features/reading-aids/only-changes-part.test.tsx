import { afterEach, beforeAll, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import type { ReactNode } from "react";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { HOST_ATTRIBUTE } from "./aided-editor";
import { said } from "./change-marks.fixture";
import { against, inProcessEditorIn } from "./comparer-fixtures";
import { destroyEditors, rootIn } from "./editor-fixtures";
import { compareWith, drawnChanges } from "./marks-plugin";
import { ONLY_CHANGES_FOLD, onlyChangesOf } from "./only-changes";
import { useOnlyChanges } from "./only-changes-part";
import { partsSlot } from "./parts-slot";
import type { Baseline } from "./use-baseline";
import type { ChangeMarks } from "./use-change-marks";
import { recordReadMarks } from "./visit";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

let forget = () => {};

afterEach(async () => {
  forget();
  forget = () => {};
  cleanup();
  await destroyEditors();
});

const doc = (changed: boolean) =>
  [
    "## Changed",
    said("body", changed ? "now" : "today"),
    "## Quiet",
    "The first quiet paragraph.",
    "The second quiet paragraph.",
  ].join("\n\n");

let documents = 0;

/** An aided editor whose marks are drawn, its parts entry, and the hook's props that show them. */
async function shown() {
  documents += 1;
  const handle = await inProcessEditorIn(
    rootIn(HOST_ATTRIBUTE),
    `dispatch://CORE-${documents}/spec`
  );
  handle.setMarkdown(doc(true));
  const baseline = { markdown: doc(false), tree: undefined };
  compareWith(handle.view, against(baseline));
  const drawn = await waitFor(() => {
    const changes = drawnChanges(handle.view);
    if (changes === undefined) throw new Error("no marks drawn yet");
    return changes;
  });
  const entry = partsSlot.entries().find((each) => each.editor === handle);
  if (entry === undefined) throw new Error("the editor got no aids");
  const read: Baseline = { baseline, choice: { kind: "chosen", version: 1 }, state: "ready" };
  const marks: ChangeMarks = { shown: drawn, state: "shown" };
  return { artifactId: `only-changes-part-${documents}`, entry, handle, marks, read };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryNavigationProvider path="/issues/CORE-1/spec">{children}</MemoryNavigationProvider>
);

const foldedCount = (root: HTMLElement) => root.querySelectorAll(`.${ONLY_CHANGES_FOLD}`).length;

test("only-changes: once the marks go, Only changes turns off and its folds go", async () => {
  const { artifactId, entry, handle, marks, read } = await shown();
  const { rerender, result } = renderHook(
    (props: { marks: ChangeMarks | undefined; read: Baseline }) =>
      useOnlyChanges(entry, artifactId, props.read, props.marks),
    { initialProps: { marks, read }, wrapper }
  );
  act(() => result.current.toggleOnlyChanges?.());
  expect(result.current.on).toBe(true);
  expect(foldedCount(handle.view.dom)).toBeGreaterThan(0);

  // A new baseline whose text the comparison refuses.
  rerender({ marks: { state: "refused" }, read });
  await waitFor(() => expect(result.current.on).toBe(false));
  expect(foldedCount(handle.view.dom)).toBe(0);

  rerender({ marks, read });
  act(() => result.current.toggleOnlyChanges?.());
  expect(result.current.on).toBe(true);
  // A baseline settled with no earlier version.
  rerender({ marks: undefined, read: { state: "none" } });
  await waitFor(() => expect(result.current.on).toBe(false));
});

test("only-changes: a sign-out ends Only changes on the open editor", async () => {
  const { artifactId, entry, handle, marks, read } = await shown();
  const queryClient = new QueryClient();
  queryClient.setQueryData(["whoami"], { login: "ada" });
  forget = recordReadMarks(queryClient);
  const { result } = renderHook(() => useOnlyChanges(entry, artifactId, read, marks), {
    wrapper,
  });
  act(() => result.current.toggleOnlyChanges?.());
  expect(onlyChangesOf(handle.view).isOn()).toBe(true);

  // Another person signs in after a lapse.
  act(() => queryClient.setQueryData(["whoami"], { login: "grace" }));
  await waitFor(() => expect(result.current.on).toBe(false));
  expect(foldedCount(handle.view.dom)).toBe(0);
});
