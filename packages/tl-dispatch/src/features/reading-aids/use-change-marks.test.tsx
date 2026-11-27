import { afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";

import { countsText } from "./change-summary";
import type { CompareRequest } from "./compare.worker";
import { InProcessWorker, inProcess } from "./comparer-fixtures";
import { destroyEditors, editorIn, rootIn } from "./editor-fixtures";
import { changeMarksPlugin } from "./marks-plugin";
import type { Baseline } from "./use-baseline";
import { type ChangeMarks, useChangeMarks } from "./use-change-marks";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

const LIVE = "## Plan\n\nThe plan keeps most of its words now.";

/** The choice and the counts the marks show, if any. */
const shownOf = (marks: ChangeMarks | undefined) =>
  marks?.state === "shown" && marks.shown !== undefined
    ? [marks.shown.choice, countsText(marks.shown.summary)]
    : undefined;

const ready = (version: number, markdown: string): Extract<Baseline, { state: "ready" }> => ({
  baseline: { markdown, tree: undefined },
  choice: { kind: "chosen", version },
  state: "ready",
});

test("change-marks during a new pick's comparison the line keeps the last marks' baseline and counts, then switches with the marks", async () => {
  const handle = await editorIn(rootIn(), undefined);
  handle.setMarkdown(LIVE);
  const { view } = handle;
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  const first = ready(8, "## Plan\n\nThe plan keeps most of its words today.");
  const { rerender, result } = renderHook(({ baseline }) => useChangeMarks(view, baseline), {
    initialProps: { baseline: first },
  });
  const counts = () => shownOf(result.current);
  await waitFor(() =>
    expect(counts()).toEqual([first.choice, "1 block, 1 changed, in 1 of 1 section"])
  );

  const held: (() => void)[] = [];
  const post = InProcessWorker.prototype.postMessage;
  const hold = spyOn(InProcessWorker.prototype, "postMessage").mockImplementation(function (
    this: InProcessWorker,
    request: CompareRequest
  ) {
    held.push(() => post.call(this, request));
  });
  const second = ready(12, LIVE);
  rerender({ baseline: second });
  await waitFor(() => expect(held).toHaveLength(1));
  expect(counts()).toEqual([first.choice, "1 block, 1 changed, in 1 of 1 section"]);

  hold.mockRestore();
  for (const go of held) go();
  await waitFor(() => expect(counts()).toEqual([second.choice, "0 blocks, in 0 of 1 section"]));
});

test("change-marks a counts line that mounts again over marks already drawn shows them, not the loading line", async () => {
  const handle = await editorIn(rootIn(), undefined);
  handle.setMarkdown(LIVE);
  const { view } = handle;
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  const first = ready(8, "## Plan\n\nThe plan keeps most of its words today.");
  const before = renderHook(() => useChangeMarks(view, first));
  await waitFor(() => expect(shownOf(before.result.current)).toBeDefined());
  before.unmount();

  const after = renderHook(() => useChangeMarks(view, first));
  expect(shownOf(after.result.current)).toEqual([
    first.choice,
    "1 block, 1 changed, in 1 of 1 section",
  ]);
});

test("change-marks another choice of the same version names the marks drawn, with no new comparison", async () => {
  const handle = await editorIn(rootIn(), undefined);
  handle.setMarkdown(LIVE);
  const { view } = handle;
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  const picked = ready(8, "## Plan\n\nThe plan keeps most of its words today.");
  const { rerender, result } = renderHook(({ baseline }) => useChangeMarks(view, baseline), {
    initialProps: { baseline: picked },
  });
  await waitFor(() => expect(shownOf(result.current)).toBeDefined());
  const sent = spyOn(InProcessWorker.prototype, "postMessage");
  try {
    const approved: typeof picked = { ...picked, choice: { kind: "approved", version: 8 } };
    rerender({ baseline: approved });
    await waitFor(() => expect(shownOf(result.current)?.[0]).toEqual(approved.choice));
    expect(sent).not.toHaveBeenCalled();
  } finally {
    sent.mockRestore();
  }
});
