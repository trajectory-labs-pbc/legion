// What the hook does with the host's reads; the baseline's decisions are in baseline.test.ts.
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { useQuery } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, StrictMode } from "react";

import { type AidedDocument, useReadMarkFault } from "@/data/document-reads";
import { readMarkKey } from "@/data/read-marks";
import { api, replaceQueryData } from "@/upstream/api";
import { versionLabel } from "@/upstream/logic/reading-aids";
import { writesOf } from "@/upstream/writes";
import { sleep } from "../../../tests/react";
import { approvalAsk, at } from "../../../tests/reading-aids/approval-asks.fixture";
import {
  aDocument,
  aVersion,
  compareWith,
  endPages,
  page,
  pick,
  versionText,
} from "../../../tests/reading-aids/baseline-page.fixture";
import { useBaseline } from "./use-baseline";
import { visitOf } from "./visit";

afterEach(endPages);

const line = (text: string) => screen.findByText(text);

type Page = ReturnType<typeof page>;

/** Upstream's read of the read mark, put in the cache as `useSpecMarks` reads it. */
const upstreamReads = (visit: Page, document: AidedDocument) =>
  act(async () => {
    const answer = await api.getDocumentRead(document.artifactId);
    visit.queryClient.setQueryData(readMarkKey(document.artifactId), answer);
  });

/** Upstream's write of `version` as the read mark, put over the cache as `useSpecMarks` puts it. */
const upstreamWrites = (visit: Page, document: AidedDocument, version: number) =>
  act(async () => {
    const key = `write-${document.artifactId}`;
    const answer = await api.putDocumentRead(document.artifactId, version, { key });
    replaceQueryData(visit.queryClient, readMarkKey(document.artifactId), answer);
  });

/** Clicks Retry, whose read waits, and holds that the button stays, busy and focused. */
async function retryHeld(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  const retry = await screen.findByRole("button", { name: "Retry" });
  await waitFor(() => expect(retry.hasAttribute("data-loading")).toBe(true));
  expect(globalThis.document.activeElement).toBe(retry);
}

/** Upstream's own read of the read mark, as `useSpecMarks` makes it on the spec's page. */
function UpstreamMarkRead({ document }: { document: AidedDocument }) {
  useQuery({
    queryFn: () => api.getDocumentRead(document.artifactId),
    queryKey: readMarkKey(document.artifactId),
  });
  return null;
}

/** A page's wrap with upstream's read of the read mark, and `extra` before the line. */
const withMarkRead = (document: AidedDocument, extra?: ReactNode) => (children: ReactNode) => (
  <>
    <UpstreamMarkRead document={document} />
    {extra}
    {children}
  </>
);

/** The read-mark fault the aids see: none, a refusal, or Retry. */
function MarkFault({ document }: { document: AidedDocument }) {
  const fault = useReadMarkFault(document.artifactId);
  const shown = fault === undefined ? "none" : (fault.refusal ?? "retry");
  return <p>{`Read mark: ${shown}`}</p>;
}

/** A part drawn before the line, named apart so React's warning for it is not deduplicated. */
function EarlierPart({ document }: { document: AidedDocument }) {
  const { baseline } = useBaseline(document);
  const version = baseline.state === "ready" ? ` v${baseline.choice.version}` : "";
  return <p>{`Earlier part: ${baseline.state}${version}`}</p>;
}

describe("the baseline", () => {
  test("an open request on the document compares with the version approved before it", async () => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
      read: 12,
    });
    await upstreamReads(visit, document);
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    await waitFor(() => expect(visit.read()?.baseline.state).toBe("ready"));
    expect(visit.read()?.baseline).toEqual({
      baseline: { markdown: versionText(8), tree: undefined },
      choice: { kind: "approved", version: 8 },
      state: "ready",
    });
  });

  test("under StrictMode two parts fix one baseline, with no warning", async () => {
    const errors = spyOn(console, "error");
    const document = aDocument(false);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
      wrap: (children) => (
        <StrictMode>
          <EarlierPart document={document} />
          {children}
        </StrictMode>
      ),
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(screen.getByText("Earlier part: ready v8")).toBeDefined();
    expect(visitOf(document.artifactId).baseline).toEqual({ kind: "approved", version: 8 });
    expect(visit.asked.versions).toEqual([8]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  test("race: the read mark is the first answer, though upstream's write lands before the editor", async () => {
    const document = aDocument();
    const visit = page(document, { asks: [[]], read: 4 });
    await upstreamReads(visit, document);
    await upstreamWrites(visit, document, 16);
    expect(visit.queryClient.getQueryData(readMarkKey(document.artifactId))).toMatchObject({
      version: 16,
    });
    visit.mount();
    expect(await line("Since v4, the version you last read")).toBeDefined();
  });

  test("the baseline waits for upstream's read-mark answer on the spec", async () => {
    const document = aDocument();
    const visit = page(document, { asks: [[]], read: 4 });
    visit.mount();
    // The asks have answered and the read mark has not: the line still loads.
    await waitFor(() => expect(visit.asked.asks).toBe(1));
    expect(screen.getByRole("status").textContent).toBe("Loading the changes…");
    await upstreamReads(visit, document);
    expect(await line("Since v4, the version you last read")).toBeDefined();
  });

  test("a failed read-mark read shows Retry, and its answer then fixes the baseline", async () => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[]],
      markFails: 1,
      read: 4,
      wrap: withMarkRead(document),
    });
    visit.mount();
    expect(await line("Could not load the changes.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await line("Since v4, the version you last read")).toBeDefined();
    expect(visit.asked.marks).toBe(2);
  });

  test("Retry of the read mark keeps its button, busy and focused, until the answer", async () => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[]],
      holdMarks: true,
      markFails: 1,
      read: 4,
      wrap: withMarkRead(document),
    });
    visit.mount();
    await waitFor(() => expect(visit.asked.marks).toBe(1));
    act(() => visit.release());
    expect(await line("Could not load the changes.")).toBeDefined();
    await retryHeld();
    await waitFor(() => expect(visit.asked.marks).toBe(2));
    act(() => visit.release());
    expect(await line("Since v4, the version you last read")).toBeDefined();
  });

  test.each<403 | 404>([403, 404])("a %d read mark counts as no read mark", async (status) => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[]],
      markRefusal: status,
      wrap: withMarkRead(document),
    });
    visit.mount();
    expect(await line("No earlier version to compare")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(visit.asked.marks).toBe(1);
  });

  test("a refused read mark asked again keeps its refusal until the answer", async () => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[]],
      holdMarks: true,
      markRefusal: 403,
      wrap: withMarkRead(document, <MarkFault document={document} />),
    });
    visit.mount();
    await waitFor(() => expect(visit.asked.marks).toBe(1));
    act(() => visit.release());
    expect(await line("Read mark: forbidden")).toBeDefined();
    await act(async () => {
      void visit.queryClient.refetchQueries({ queryKey: readMarkKey(document.artifactId) });
    });
    await waitFor(() => expect(visit.asked.marks).toBe(2));
    expect(screen.getByText("Read mark: forbidden")).toBeDefined();
    act(() => visit.release());
    expect(await line("Read mark: forbidden")).toBeDefined();
  });

  test("an open request with an approved version does not wait for a failed read mark", async () => {
    const document = aDocument();
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
      markFails: 1,
      read: 4,
      wrap: withMarkRead(document),
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("return: a new editor keeps the visit's baseline and its Compare-with choice", async () => {
    const document = aDocument();
    const visit = page(document, { asks: [[]], read: 4 });
    await upstreamReads(visit, document);
    const first = visit.mount();
    expect(await line("Since v4, the version you last read")).toBeDefined();
    await upstreamWrites(visit, document, 16);
    first.unmount();

    const second = visit.mount();
    expect(await line("Since v4, the version you last read")).toBeDefined();
    const address = window.location.href;
    await pick("Version 12");
    expect(await line("Since v12")).toBeDefined();
    expect(window.location.href).toBe(address);
    await waitFor(() =>
      expect(visit.read()?.baseline).toMatchObject({ baseline: { markdown: versionText(12) } })
    );
    second.unmount();

    visit.mount();
    expect(await line("Since v12")).toBeDefined();
  });

  test("change-marks a new editor in the visit gets the very baseline object the marks keep their pairs by, and a reload's read a new one", async () => {
    const document = aDocument(false);
    const asks = [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]];
    const visit = page(document, { asks });
    const shownText = (read: ReturnType<typeof visit.read>) =>
      read?.baseline.state === "ready" ? read.baseline.baseline : undefined;
    const first = visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    const kept = shownText(visit.read());
    expect(kept).toBeDefined();
    first.unmount();
    // A return comes later than the cache's sweep of a read nothing shows.
    await new Promise((done) => setTimeout(done, 20));

    const second = visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(shownText(visit.read())).toBe(kept);
    second.unmount();

    // A reload starts with a new page's reads.
    const reloaded = page(document, { asks });
    reloaded.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(shownText(reloaded.read())).toEqual(kept);
    expect(shownText(reloaded.read())).not.toBe(kept);
  });

  test("a sign-out ends the visit's pick, and the line draws again from the answers", async () => {
    const document = aDocument(false);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    await pick("Version 12");
    expect(await line("Since v12")).toBeDefined();
    act(() => writesOf(visit.queryClient).signedOut("alice"));
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(visitOf(document.artifactId).compareWith).toBeUndefined();
  });

  test("a sign-out gives the next visit a ready baseline of its own, of the same text and choice", async () => {
    const document = aDocument(false);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    const before = visit.read()?.baseline;
    act(() => writesOf(visit.queryClient).signedOut("alice"));
    await waitFor(() => expect(visit.read()?.baseline).not.toBe(before));
    expect(visit.read()?.baseline).toEqual(before);
  });

  test("a pick from the keyboard keeps the focus on Compare with while the version loads", async () => {
    const document = aDocument(false);
    const visit = page(document, { asks: [[]], held: [4] });
    visit.mount();
    expect(await line("No earlier version to compare")).toBeDefined();
    compareWith().focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("option", { name: "Version 4" })).toBeDefined();
    await userEvent.keyboard("{End}{Enter}");
    expect(await line("Loading the changes…")).toBeDefined();
    expect(globalThis.document.activeElement).toBe(compareWith());
    visit.release();
    expect(await line("Since v4")).toBeDefined();
    expect(globalThis.document.activeElement).toBe(compareWith());
  });

  test("Retry of a failed pick keeps its button, busy and focused, over the last version's text", async () => {
    const document = aDocument(false);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
      brokenOnce: [12],
      held: [12],
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    await pick("Version 12");
    await waitFor(() => expect(visit.asked.versions).toEqual([8, 12]));
    act(() => visit.release());
    expect(await line("Could not load the changes.")).toBeDefined();
    await retryHeld();
    expect(screen.queryByText("Since v8, the last approved version")).toBeNull();
    await waitFor(() => expect(visit.asked.versions).toEqual([8, 12, 12]));
    act(() => visit.release());
    expect(await line("Since v12")).toBeDefined();
  });

  test("during a pick the line keeps the last baseline until the picked version answers", async () => {
    const document = aDocument(false);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
      held: [12],
    });
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    const before = visit.read()?.baseline;
    await pick("Version 12");
    await waitFor(() => expect(visit.asked.versions).toEqual([8, 12]));
    expect(screen.getByText("Since v8, the last approved version")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
    expect(visit.read()?.baseline).toBe(before);
    visit.release();
    expect(await line("Since v12")).toBeDefined();
  });

  test("neither: no baseline, no version read, and Compare with beside the line", async () => {
    const document = aDocument(false);
    const visit = page(document, { asks: [[]] });
    visit.mount();
    expect(await line("No earlier version to compare")).toBeDefined();
    expect(compareWith().textContent).toContain("Compare with");
    expect(visit.read()?.baseline).toEqual({ state: "none" });
    expect(visit.asked.versions).toEqual([]);
  });

  test("a one-version document compares with version 1, the only one Compare with offers", async () => {
    const document = aDocument(false, [1]);
    const visit = page(document, {
      asks: [[approvalAsk(at(document.artifactId, 1), { approved: 1 })]],
    });
    visit.mount();
    expect(await line("Since v1, the last approved version")).toBeDefined();
    await userEvent.click(compareWith());
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Version 1"]);
  });

  describe("Compare with names each version as the page's own picker does, newest first", () => {
    const versions = [
      { ...aVersion(12), named: true, summary: "Before review" },
      { ...aVersion(8), summary: "fixed typo" },
    ];

    async function namesOn(document: AidedDocument): Promise<(string | null)[]> {
      page(document, { asks: [[]] }).mount();
      expect(await line("No earlier version to compare")).toBeDefined();
      await userEvent.click(compareWith());
      const options = await screen.findAllByRole("option");
      return options.map((option) => option.textContent);
    }

    test("the issue's spec tab, whose picker shows a summary only for a named version", async () => {
      expect(await namesOn({ ...aDocument(false), versions })).toEqual([
        "Version 12 — Before review",
        "Version 8",
      ]);
    });

    test.each<[string, Partial<AidedDocument>]>([
      ["an issue's artifact", { slug: "verification-md" }],
      ["a project document", { owner: { kind: "project", project: "CORE" } }],
    ])("%s, whose picker is upstream's artifact header", async (_page, place) => {
      const document: AidedDocument = {
        ...aDocument(false),
        ...place,
        picker: "artifact",
        versions,
      };
      expect(await namesOn(document)).toEqual(versions.map(versionLabel));
    });
  });

  describe("a version read that cannot answer keeps Compare with, for another pick", () => {
    const noRetry = () => expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    test("a picked version that is not found says so, with no Retry", async () => {
      const document = aDocument();
      const visit = page(document, { asks: [[]], missing: [12], read: 4 });
      await upstreamReads(visit, document);
      visit.mount();
      expect(await line("Since v4, the version you last read")).toBeDefined();
      await pick("Version 12");
      expect(await line("v12 is not found")).toBeDefined();
      noRetry();
      await pick("Version 8");
      expect(await line("Since v8")).toBeDefined();
    });

    test("a read mark that names a removed version", async () => {
      const document = aDocument();
      const visit = page(document, { asks: [[]], missing: [5], read: 5 });
      await upstreamReads(visit, document);
      visit.mount();
      expect(await line("v5 is not found")).toBeDefined();
      noRetry();
      await pick("Version 8");
      expect(await line("Since v8")).toBeDefined();
    });

    test("the approved version is not found", async () => {
      const document = aDocument(false);
      const visit = page(document, {
        asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
        missing: [8],
      });
      visit.mount();
      expect(await line("v8 is not found")).toBeDefined();
      await pick("Version 12");
      expect(await line("Since v12")).toBeDefined();
    });

    test("a version the reader has no access to says so, with no Retry", async () => {
      const document = aDocument(false);
      const visit = page(document, { asks: [[]], forbidden: [12] });
      visit.mount();
      expect(await line("No earlier version to compare")).toBeDefined();
      await pick("Version 12");
      expect(await line("You cannot see v12")).toBeDefined();
      noRetry();
      await pick("Version 8");
      expect(await line("Since v8")).toBeDefined();
    });

    test("a refused version picked again says so at once, and is not asked again", async () => {
      const document = aDocument(false);
      const visit = page(document, { asks: [[]], forbidden: [12], held: [12] });
      visit.mount();
      expect(await line("No earlier version to compare")).toBeDefined();
      await pick("Version 12");
      await waitFor(() => expect(visit.asked.versions).toEqual([12]));
      act(() => visit.release());
      expect(await line("You cannot see v12")).toBeDefined();
      await pick("Version 8");
      expect(await line("Since v8")).toBeDefined();
      await pick("Version 12");
      expect(screen.getByText("You cannot see v12")).toBeDefined();
      noRetry();
      await sleep(50);
      expect(visit.asked.versions).toEqual([12, 8]);
    });

    test("a refused pick's refusal does not carry to the next pick, while it is read", async () => {
      const document = aDocument(false);
      const visit = page(document, {
        asks: [[approvalAsk(at(document.artifactId, 16), { approved: 8 })]],
        forbidden: [12],
        held: [8],
        unavailable: [8],
      });
      visit.mount();
      await waitFor(() => expect(visit.asked.versions).toEqual([8]));
      act(() => visit.release());
      expect(await line("Could not load the changes.")).toBeDefined();
      await pick("Version 12");
      expect(await line("You cannot see v12")).toBeDefined();
      await pick("Version 8");
      await waitFor(() => expect(visit.asked.versions).toEqual([8, 12, 8]));
      // The line last saw v12's refusal, newer than v8's failure, so v8 loads while it is read.
      expect(screen.queryByText("You cannot see v8")).toBeNull();
      expect(screen.getByText("Loading the changes…")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      act(() => visit.release());
      expect(await line("Could not load the changes.")).toBeDefined();
      const retry = screen.getByRole("button", { name: "Retry" });
      expect(retry.hasAttribute("data-loading")).toBe(false);
    });

    test("a version that is a file says so, with no Retry", async () => {
      const document = aDocument(false);
      const visit = page(document, { asks: [[]], blob: [12] });
      visit.mount();
      expect(await line("No earlier version to compare")).toBeDefined();
      await pick("Version 12");
      expect(await line("v12 has no text to compare")).toBeDefined();
      noRetry();
      await pick("Version 8");
      expect(await line("Since v8")).toBeDefined();
    });
  });

  test("the line says the text changed since the version the request named", async () => {
    const document = aDocument();
    const request = approvalAsk(at(document.artifactId, 16, 15), {
      approved: 8,
      documents: [at(document.artifactId, 16, 15)],
    });
    const visit = page(document, { asks: [[request]], read: 12 });
    await upstreamReads(visit, document);
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    expect(
      screen.getByText("The text changed since v15, the version that the request named")
    ).toBeDefined();
  });

  test("late-asks: a failed asks read shows Retry, and the good answer then fixes the baseline", async () => {
    const document = aDocument();
    const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
    const visit = page(document, { asks: ["fail", [request]], read: 4 });
    await upstreamReads(visit, document);
    visit.mount();
    expect(await line("Could not load the changes.")).toBeDefined();
    expect(screen.getByText("The document.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await line("Since v8, the last approved version")).toBeDefined();
  });

  test("an answer to the request during the visit leaves the baseline as it was", async () => {
    const document = aDocument();
    const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
    const answered = approvalAsk(at(document.artifactId, 16), { approved: 8, state: "answered" });
    const visit = page(document, { asks: [[request], [answered]], read: 4 });
    await upstreamReads(visit, document);
    visit.mount();
    expect(await line("Since v8, the last approved version")).toBeDefined();
    const ready = visit.read()?.baseline;
    await act(() => visit.queryClient.invalidateQueries({ queryKey: ["asks"] }));
    await waitFor(() => expect(visit.asked.asks).toBe(2));
    expect(screen.getByText("Since v8, the last approved version")).toBeDefined();
    expect(visit.read()?.baseline).toBe(ready);
  });
});
