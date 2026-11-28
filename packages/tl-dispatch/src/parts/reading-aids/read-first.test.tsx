import { afterEach, beforeAll, expect, mock, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { commandStore } from "@/commands/command-store";
import { api } from "@/upstream/api";
import type { IssueAskRow, IssueDetails, LiveServerFrame } from "@/upstream/contract";
import type { ConnectionCallbacks, DocumentConnection } from "@/upstream/editor/frame";
import { liveSocketFor, useEventFeed } from "@/upstream/live";
import { actorLabelText, buildDispatchReference } from "@/upstream/logic/reading-aids";
import { MemoryNavigationProvider } from "../../../tests/navigation";
import { answered } from "../../../tests/network";
import {
  APPROVED,
  CHANGED_SECTIONS,
  REVISED,
  said,
} from "../../../tests/reading-aids/change-marks.fixture";
import { InProcessWorker, inProcessEditorIn } from "../../../tests/reading-aids/comparer-fixtures";
import { blockIdsOf, destroyEditors } from "../../../tests/reading-aids/editor-fixtures";
import {
  installFakeLiveSockets,
  quietConsoleError,
  warmMarkdownRenderer,
} from "../../../tests/upstream";
import { AidParts } from "./aid-parts";
import { HOST_ATTRIBUTE } from "./aided-editor";
import { ONLY_CHANGES_FOLD } from "./only-changes";
import { partsSlot, reportingSync } from "./parts-slot";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

const KEY = "CORE-1";
const SPEC = "artifact-spec";
const VERIFICATION = "artifact-verification";
const SPEC_REF = buildDispatchReference({ key: KEY, kind: "spec" });
const VERIFICATION_REF = buildDispatchReference({
  key: KEY,
  kind: "artifact",
  slug: "verification",
});

/** What each artifact of the issue read says of its owner. */
const OWNED = { issue_key: KEY, project: "CORE", session_id: null };

afterEach(async () => {
  cleanup();
  mock.restore();
  window.location.hash = "";
  await destroyEditors();
});

const issue = {
  artifacts: [
    { ...OWNED, id: SPEC, kind: "doc", name: "spec.md", primary: true, slug: "spec" },
    {
      ...OWNED,
      id: VERIFICATION,
      kind: "doc",
      name: "verification.md",
      primary: false,
      slug: "verification",
    },
  ],
  key: KEY,
} as unknown as IssueDetails;

const ask = (fields: Partial<IssueAskRow>): IssueAskRow =>
  ({
    author: { id: "01a086ad", kind: "session" },
    created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    id: "ask",
    issue_key: KEY,
    kind: "question",
    question: "A question?",
    state: "open",
    urgency: "med",
    ...fields,
  }) as IssueAskRow;

/** An open decision on the spec's block `blockId`. */
const decision = (id: string, blockId: string | undefined, fields: Partial<IssueAskRow> = {}) =>
  ask({
    block_artifact: { id: SPEC, primary: true, slug: "spec" },
    block_id: blockId,
    id,
    ...fields,
  });

/** A request on the spec at v15 that also names its verification at v6, the spec approved at v8. */
const twoDocuments = ask({
  approval: {
    approved: { at: "2026-11-20T10:00:00Z", by: { id: "ada", kind: "user" }, version: 8 },
    artifact_id: SPEC,
    documents: [
      { artifact_id: SPEC, name: "spec.md", requested_version: 15, version: 15 },
      { artifact_id: VERIFICATION, name: "verification.md", requested_version: 6, version: 6 },
    ],
    name: "spec.md",
    requested_version: 15,
    version: 15,
  },
  id: "request",
  kind: "approval",
  question: "Approve spec.md (version 15) and verification.md (version 6)?",
  urgency: "high",
  waiting_on: "human",
  waiting_on_person: "ada",
} as Partial<IssueAskRow>);

const CALLBACKS: ConnectionCallbacks = {
  onAdmission: () => {},
  onOutsideSchema: () => {},
  onPending: () => {},
  onStatus: () => {},
  onSynced: () => {},
  schemaCreatable: 0,
  schemaVersion: 0,
};

/** Connects `artifactId` as the host's transport does, and gives back its first sync. */
function connect(artifactId: string): () => void {
  let synced = () => {};
  reportingSync((_, callbacks) => {
    synced = () => callbacks.onSynced();
    return {} as DocumentConnection;
  })(artifactId, CALLBACKS);
  return () => act(synced);
}

/** An aided editor and its parts, synced unless `synced` is false; earlier versions read `earlier`. */
async function mount(
  documentRef: string,
  markdown: string,
  asks: (blocks: readonly string[]) => IssueAskRow[],
  {
    beside = null,
    earlier = markdown,
    issueRead = Promise.resolve(issue),
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    synced = true,
    tree,
  }: {
    beside?: ReactNode;
    earlier?: string;
    issueRead?: Promise<IssueDetails>;
    queryClient?: QueryClient;
    synced?: boolean;
    tree?: { readonly type: string };
  } = {}
) {
  const host = document.body.appendChild(document.createElement("div"));
  host.setAttribute(HOST_ATTRIBUTE, "");
  host.tabIndex = -1;
  const handle = await inProcessEditorIn(
    host.appendChild(document.createElement("div")),
    documentRef
  );
  handle.setMarkdown(markdown);
  const blocks = blockIdsOf(handle.view);
  const sync = connect(documentRef === VERIFICATION_REF ? VERIFICATION : SPEC);
  if (synced) sync();
  const entry = partsSlot.entries().find((each) => each.editor === handle);
  if (entry === undefined) throw new Error("the editor got no aids");
  spyOn(api, "getIssue").mockReturnValue(issueRead);
  const asksRead = spyOn(api, "listIssueAsks").mockImplementation(async () => asks(blocks));
  // The counts line's read of the version a request approved.
  const versionRead = spyOn(api, "getArtifactVersion").mockImplementation(async (_id, number) => ({
    authors: [],
    created_at: "2026-11-20T10:00:00Z",
    markdown: earlier,
    ...(tree === undefined ? {} : { markdown_tree: tree }),
    named: false,
    number,
    summary: null,
  }));
  const focusBlock = spyOn(handle, "focusBlock").mockImplementation(() => {});
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryNavigationProvider path={`/issues/${KEY}/spec`}>
        <AidParts entry={entry} shown />
      </MemoryNavigationProvider>
      {beside}
    </QueryClientProvider>
  );
  const refresh = () => act(() => queryClient.invalidateQueries({ queryKey: ["asks", KEY] }));
  return { asksRead, blocks, focusBlock, host, refresh, sync, versionRead };
}

const readFirst = async () => within(await screen.findByRole("region", { name: "Read first" }));
const rows = async () => within(await screen.findByRole("list")).getAllByRole("listitem");
const firstRow = async () => {
  const [row] = await rows();
  if (row === undefined) throw new Error("Read first lists nothing");
  return within(row);
};

test("read-first: on the spec's page a request names the spec as text at v15, then the verification as a link at v6", async () => {
  await mount(SPEC_REF, "Text.", () => [twoDocuments]);
  const inRow = await firstRow();
  expect(inRow.getByText("spec.md v15").closest("a")).toBeNull();
  expect(inRow.getByRole("link", { name: "verification.md v6" }).getAttribute("href")).toBe(
    `/issues/${KEY}/artifacts/verification`
  );
  expect(inRow.getAllByText(/\.md v\d+$/).map((each) => each.textContent)).toEqual([
    "spec.md v15",
    "verification.md v6",
  ]);
  expect(inRow.getByText("Approved before: v8")).toBeDefined();
  expect(inRow.getByText("High")).toBeDefined();
  expect(inRow.getByText("Waiting on ada")).toBeDefined();
  const question = inRow.getByText(twoDocuments.question);
  expect(question.className).toContain("line-clamp-2");
  expect(question.className).toContain("[overflow-wrap:anywhere]");
  expect(question.getAttribute("title")).toBe(twoDocuments.question);
});

test("read-first: a primary artifact that is no document links to its artifact page, not to the spec", async () => {
  const filed = {
    ...issue,
    artifacts: [
      { ...OWNED, id: SPEC, kind: "file", name: "spec.md", primary: true, slug: "spec-file" },
      ...(issue.artifacts ?? []).slice(1),
    ],
  } as unknown as IssueDetails;
  await mount(VERIFICATION_REF, "Text.", () => [twoDocuments], {
    issueRead: Promise.resolve(filed),
  });
  const inRow = await firstRow();
  expect(inRow.getByRole("link", { name: "spec.md v15" }).getAttribute("href")).toBe(
    `/issues/${KEY}/artifacts/spec-file`
  );
});

test("read-first: on the verification's page the spec is the link at v15 and the verification text at v6", async () => {
  await mount(VERIFICATION_REF, "Text.", () => [twoDocuments]);
  const inRow = await firstRow();
  expect(inRow.getAllByRole("link").map((link) => link.textContent)).toEqual(["spec.md v15"]);
  expect(inRow.getByRole("link").getAttribute("href")).toBe(`/issues/${KEY}/spec`);
  expect(inRow.getByText("verification.md v6").closest("a")).toBeNull();
  expect(inRow.getByText("Approved before: v8")).toBeDefined();
});

test("read-first: a request from a server older than the documents list names its lead fields", async () => {
  const { approval } = twoDocuments;
  if (approval === undefined) throw new Error("no approval");
  const { documents: _list, ...lead } = approval;
  await mount(SPEC_REF, "Text.", () => [
    ask({
      ...twoDocuments,
      approval: { ...lead, requested_version: 16, version: 16 } as IssueAskRow["approval"],
    }),
  ]);
  const inRow = await firstRow();
  expect(inRow.getByText("spec.md v16")).toBeDefined();
  expect(inRow.queryByText(/^verification\.md/)).toBeNull();
});

test("read-first: a document the issue does not list is text, and a request never approved before says so", async () => {
  const unlisted = ask({
    approval: {
      artifact_id: SPEC,
      documents: [
        { artifact_id: SPEC, name: "spec.md", requested_version: 3, version: 3 },
        { artifact_id: "artifact-gone", name: "notes.md", requested_version: 2, version: 2 },
      ],
      name: "spec.md",
      requested_version: 3,
      version: 3,
    },
    id: "request",
    kind: "approval",
  } as Partial<IssueAskRow>);
  await mount(SPEC_REF, "Text.", () => [unlisted]);
  const inRow = await firstRow();
  expect(inRow.queryAllByRole("link")).toEqual([]);
  expect(inRow.getByText("notes.md v2")).toBeDefined();
  expect(inRow.getByText("Not approved before")).toBeDefined();
});

test("DOC-1 read-first: each open decision is one line, in the document's order, and an answered one is not listed", async () => {
  await mount(SPEC_REF, "First.\n\nSecond.\n\nThird.\n\nFourth.", (blocks) => [
    decision("c", blocks[2], { question: "Third decision?" }),
    decision("a", blocks[0], { question: "First decision?" }),
    decision("x", blocks[1], { question: "Answered decision?", state: "answered" }),
    decision("b", blocks[3], { question: "Fourth decision?" }),
  ]);
  expect((await rows()).map((row) => within(row).getByRole("link").textContent)).toEqual([
    "First decision?",
    "Third decision?",
    "Fourth decision?",
  ]);
});

test("DOC-2 read-first: a click on a decision sets its #b- anchor and moves to its block, also a second time, with the focus on the host", async () => {
  const user = userEvent.setup();
  const { blocks, focusBlock, host } = await mount(SPEC_REF, "First.\n\nSecond.", (ids) => [
    decision("a", ids[1], { question: "Ship it?" }),
  ]);
  const link = await (await readFirst()).findByRole("link", { name: "Ship it?" });
  expect(link.getAttribute("href")).toBe(`#b-${blocks[1]}`);

  await user.click(link);
  expect(window.location.hash).toBe(`#b-${blocks[1]}`);
  expect(focusBlock).toHaveBeenLastCalledWith(blocks[1]);
  const calls = focusBlock.mock.calls.length;
  await user.click(link);
  expect(focusBlock.mock.calls.length).toBeGreaterThan(calls);
  expect(document.activeElement).toBe(host);
});

test("DOC-3 read-first: the next decision and the previous one wrap at the ends, and leave the address", async () => {
  const { blocks, focusBlock, host } = await mount(SPEC_REF, "First.\n\nSecond.", (ids) => [
    decision("b", ids[1], { question: "Second?" }),
    decision("a", ids[0], { question: "First?" }),
  ]);
  await (await readFirst()).findByRole("link", { name: "Second?" });
  const visited: unknown[] = [];
  for (const id of ["next", "next", "next", "previous", "previous"]) {
    act(() => void commandStore.run(`reading-aids.${id}-decision`));
    visited.push(focusBlock.mock.lastCall?.[0]);
  }
  expect(visited).toEqual([blocks[0], blocks[1], blocks[0], blocks[1], blocks[0]]);
  expect(window.location.hash).toBe("");
  expect(document.activeElement).toBe(host);
});

test("DOC-4 read-first: a document with no request and no decision says so, and its decision keys are off", async () => {
  await mount(SPEC_REF, "Text.", () => []);
  expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
  expect(commandStore.view("reading-aids.next-decision")?.enabled).toBe(false);
  expect(commandStore.view("reading-aids.previous-decision")?.enabled).toBe(false);
});

test("DOC-5 read-first: a decision leaves the list once the asks read answers it answered", async () => {
  let state: IssueAskRow["state"] = "open";
  const { refresh } = await mount(SPEC_REF, "First.", (ids) => [
    decision("a", ids[0], { question: "Ship it?", state }),
  ]);
  await (await readFirst()).findByRole("link", { name: "Ship it?" });
  state = "answered";
  await refresh();
  expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
});

/** Upstream's live event feed, as the app's shell mounts it. */
function EventFeed() {
  useEventFeed();
  return null;
}

test("aids-reads: an event on the live socket for an answered decision takes it off Read first, with only upstream's read of the asks", async () => {
  const sockets = installFakeLiveSockets();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["whoami"], { event_head: "0", kind: "user", login: "alice" });
  try {
    let state: IssueAskRow["state"] = "open";
    const { asksRead, versionRead } = await mount(
      SPEC_REF,
      "First.",
      (ids) => [decision("a", ids[0], { question: "Ship it?", state })],
      { beside: <EventFeed />, queryClient }
    );
    await (await readFirst()).findByRole("link", { name: "Ship it?" });
    const socket = sockets.latest();
    act(() => socket.open());
    const { sub } = socket.subscribed("events");
    act(() => socket.receive({ replay_complete: true, since: "0", sub, type: "events_start" }));
    const [asks, versions] = [asksRead.mock.calls.length, versionRead.mock.calls.length];
    state = "answered";
    // The frame as Dispatch sends it: the ask's answer, as upstream's own event tests write it.
    const answered: LiveServerFrame = JSON.parse(
      JSON.stringify({
        event: {
          actor: { id: "ada", kind: "user" },
          created_at: "2026-11-20T11:00:00Z",
          id: 1,
          issue_key: KEY,
          notify: true,
          payload: { anchor: null, id: "a" },
          project: "CORE",
          seq: 1,
          type: "ask.answered",
        },
        id: "1",
        sub,
        type: "event",
      })
    );
    act(() => socket.receive(answered));
    expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
    expect(asksRead.mock.calls.length).toBe(asks + 1);
    expect(versionRead.mock.calls.length).toBe(versions);
  } finally {
    liveSocketFor(queryClient).close();
    sockets.restore();
  }
});

test("DOC-7 read-first: a decision's question and a request's are drawn as their plain words", async () => {
  await mount(SPEC_REF, "First.", (ids) => [
    { ...twoDocuments, question: "Approve **both** documents?" },
    decision("a", ids[0], { question: "Use `Postgres` _now_?" }),
  ]);
  await (await readFirst()).findByRole("link", { name: "Use Postgres now?" });
  expect((await readFirst()).getByText("Approve both documents?")).toBeDefined();
});

test("read-first: a question's control characters are dropped, as upstream's navigator drops them", async () => {
  await mount(SPEC_REF, "First.", (ids) => [
    { ...twoDocuments, question: "Approve\u0007 both?\u0000" },
    decision("a", ids[0], { question: "Ship\u001b it?\u0008" }),
  ]);
  const link = await (await readFirst()).findByRole("link", { name: "Ship it?" });
  expect(link.textContent).toBe("Ship it?");
  expect((await readFirst()).getByText("Approve both?").textContent).toBe("Approve both?");
});

test("read-first: a decision's question is cut to two lines, with its whole words as its title", async () => {
  const question = "Ship the new reader to every team before the next release is cut?";
  await mount(SPEC_REF, "First.", (ids) => [decision("a", ids[0], { question })]);
  const link = await (await readFirst()).findByRole("link", { name: question });
  expect(link.getAttribute("title")).toBe(question);
  // The cut is on the words inside, so the link's own box can grow its pointer target.
  expect(link.className).not.toContain("line-clamp-2");
  expect(link.firstElementChild?.className).toContain("line-clamp-2");
});

test("read-first: its region carries the mark that the stylesheet keys upstream's navigator on", async () => {
  await mount(SPEC_REF, "Text.", () => []);
  const region = await screen.findByRole("region", { name: "Read first" });
  expect(region.hasAttribute("data-reading-aids-read-first")).toBe(true);
});

test("read-first: before the server's first sync of the document it says Loading, not that nothing is open", async () => {
  const { asksRead, sync } = await mount(SPEC_REF, "Text.", () => [], { synced: false });
  await waitFor(() => expect(asksRead).toHaveBeenCalled());
  await act(async () => {});
  expect((await readFirst()).queryByText("No open requests or decisions")).toBeNull();
  expect((await readFirst()).getByText("Loading…")).toBeDefined();
  sync();
  expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
});

test("read-first: an empty document, once synced, says that nothing is open", async () => {
  await mount(SPEC_REF, "", () => []);
  expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
});

test("read-first: a request waits on the agent whose reply is the newest, as upstream's card says", async () => {
  const replier = { id: "reply-session", kind: "session", origin: { session_title: "Builder" } };
  await mount(SPEC_REF, "Text.", () => [
    ask({
      ...twoDocuments,
      last_reply: { author: replier, created_at: new Date().toISOString() },
      waiting_on: "agent",
    } as Partial<IssueAskRow>),
  ]);
  const inRow = await firstRow();
  expect(
    inRow.getByText(`Waiting on ${actorLabelText(replier as IssueAskRow["author"])}`)
  ).toBeDefined();
  expect(actorLabelText(replier as IssueAskRow["author"])).not.toBe(
    actorLabelText(twoDocuments.author)
  );
});

test("read-first: while its document is not resolved, the shown parts keep the decision keys, off", async () => {
  await mount(SPEC_REF, "Text.", () => [], { issueRead: new Promise<IssueDetails>(() => {}) });
  expect(screen.queryByRole("region", { name: "Read first" })).toBeNull();
  expect(commandStore.view("reading-aids.next-decision")?.enabled).toBe(false);
  expect(commandStore.view("reading-aids.previous-decision")?.enabled).toBe(false);
});

test("read-first: a decision on a block the document no longer has is not listed", async () => {
  await mount(SPEC_REF, "First.", () => [decision("a", "gone-block", { question: "Gone?" })]);
  expect(await (await readFirst()).findByText("No open requests or decisions")).toBeDefined();
});

test("read-first: a failed first read shows one line with Retry, and a failed refresh keeps the list", async () => {
  const user = userEvent.setup();
  let fail = true;
  let failures = 0;
  const { refresh } = await mount(SPEC_REF, "Text.", () => {
    if (!fail) return [twoDocuments];
    failures += 1;
    throw new Error("down");
  });
  const retry = await (await readFirst()).findByRole("button", { name: "Retry" });
  fail = false;
  await user.click(retry);
  await rows();
  fail = true;
  const before = failures;
  await refresh();
  expect(failures).toBeGreaterThan(before);
  expect((await readFirst()).getByText("spec.md v15")).toBeDefined();
  expect((await readFirst()).queryByRole("button", { name: "Retry" })).toBeNull();
});

for (const [status, words] of [
  [403, "You cannot see the requests and decisions."],
  [404, "Could not find the requests and decisions."],
] as const) {
  test(`read-first: a ${status} from the first read says so, with no Retry, as trying again cannot help`, async () => {
    await mount(SPEC_REF, "Text.", () => {
      throw answered(status);
    });
    expect(await (await readFirst()).findByText(words)).toBeDefined();
    expect((await readFirst()).queryByRole("button", { name: "Retry" })).toBeNull();
  });
}

test("read-first: a request that waits on the reader with no person named says it waits on you", async () => {
  await mount(SPEC_REF, "Text.", () => [{ ...twoDocuments, waiting_on_person: "" } as IssueAskRow]);
  expect((await firstRow()).getByText("Waiting on you")).toBeDefined();
});

const EARLIER = "# Plan\n\nThe plan stays.\n\n## Rollout\n\nWe ship in the spring.";
const CHANGED = "# Plan\n\nThe plan stays.\n\n## Rollout\n\nWe ship in the spring, after a pilot.";

const countsLine = () => {
  const line = document.querySelector<HTMLElement>("[data-reading-aids-counts]");
  if (line === null) throw new Error("no counts line");
  return within(line);
};

test("DOC-8 read-first: the counts line counts the changed blocks against the baseline, with a link to each changed section", async () => {
  const user = userEvent.setup();
  const { blocks, focusBlock } = await mount(SPEC_REF, CHANGED, () => [twoDocuments], {
    earlier: EARLIER,
  });
  expect(
    await screen.findByText(
      "Since v8, the last approved version: 1 block, 1 changed, in 1 of 2 sections"
    )
  ).toBeDefined();
  const link = countsLine().getByRole("link", { name: "Rollout" });
  expect(countsLine().queryByRole("link", { name: "Plan" })).toBeNull();
  // A section's link goes to its heading.
  expect(link.getAttribute("href")).toBe(`#b-${blocks[2]}`);
  await user.click(link);
  expect(window.location.hash).toBe(`#b-${blocks[2]}`);
  expect(focusBlock).toHaveBeenLastCalledWith(blocks[2]);
});

test("DOC-8 read-first: on the approval's plan the line gives 7 blocks in 5 of 7 sections, with one link for each of the 5", async () => {
  await mount(SPEC_REF, REVISED, () => [twoDocuments], { earlier: APPROVED });
  expect(
    await screen.findByText(
      "Since v8, the last approved version: 7 blocks, 6 changed, 1 added, in 5 of 7 sections"
    )
  ).toBeDefined();
  expect(
    countsLine()
      .getAllByRole("link")
      .map((link) => link.textContent)
  ).toEqual(CHANGED_SECTIONS);
});

/** A plan whose first section changed and whose second, which holds a decision, did not. */
const quietDecision = (changed: boolean) =>
  [
    "## Changed",
    said("changed", changed ? "now" : "today"),
    "## Quiet",
    "The first quiet paragraph.",
    "The paragraph a decision is on.",
    "The last quiet paragraph.",
  ].join("\n\n");

test("read-first: a click on a decision in a part that Only changes folds opens the part", async () => {
  const user = userEvent.setup();
  const { blocks, focusBlock, host } = await mount(
    SPEC_REF,
    quietDecision(true),
    (ids) => [twoDocuments, decision("a", ids[4], { question: "Keep the quiet part?" })],
    { earlier: quietDecision(false) }
  );
  // The handle's own move, which opens the folds around its block.
  focusBlock.mockRestore();
  await user.click(await screen.findByRole("button", { name: "Only changes" }));
  const decided = () => host.querySelector(`[data-block-id="${blocks[4]}"]`);
  expect(decided()?.classList.contains(ONLY_CHANGES_FOLD)).toBe(true);

  await user.click(await (await readFirst()).findByRole("link", { name: "Keep the quiet part?" }));
  expect(window.location.hash).toBe(`#b-${blocks[4]}`);
  await waitFor(() => expect(decided()?.classList.contains(ONLY_CHANGES_FOLD)).toBe(false));
  expect(document.activeElement).toBe(host);
});

test("only-changes: the counts line holds the fold control beside Only changes, and the parts hold it once", async () => {
  const folding = (changed: boolean) =>
    [quietDecision(changed), ":::requirement{#r1}", "**R1.** A requirement.", ":::"].join("\n\n");
  await mount(SPEC_REF, folding(true), () => [twoDocuments], { earlier: folding(false) });
  await screen.findByRole("button", { name: "Only changes" });
  expect(countsLine().getByRole("button", { name: "Only changes" })).toBeDefined();
  expect(countsLine().getByRole("button", { name: "Fold or open blocks" })).toBeDefined();
  expect(screen.getAllByRole("button", { name: "Fold or open blocks" })).toHaveLength(1);
});

test("DOC-8 read-first: with nothing changed since the baseline, the line says so and links no section", async () => {
  await mount(SPEC_REF, EARLIER, () => [twoDocuments]);
  expect(await screen.findByText("No changes since v8")).toBeDefined();
  expect(countsLine().queryByRole("link")).toBeNull();
});

test("DOC-8 read-first: while the first comparison runs, the line says it loads", async () => {
  const held: (() => void)[] = [];
  const post = InProcessWorker.prototype.postMessage;
  spyOn(InProcessWorker.prototype, "postMessage").mockImplementation(function (
    this: InProcessWorker,
    request
  ) {
    held.push(() => post.call(this, request));
  });
  await mount(SPEC_REF, CHANGED, () => [twoDocuments], { earlier: EARLIER });
  await waitFor(() => expect(held).toHaveLength(1));
  expect(countsLine().getByRole("status").textContent).toBe("Loading the changes…");
  mock.restore();
  for (const go of held) go();
  expect(
    await screen.findByText(
      "Since v8, the last approved version: 1 block, 1 changed, in 1 of 2 sections"
    )
  ).toBeDefined();
});

test("DOC-8 read-first: a baseline whose text the comparison refuses says so, with no Retry and no marks", async () => {
  await mount(SPEC_REF, CHANGED, () => [twoDocuments], {
    earlier: EARLIER,
    tree: { type: "not-a-document" },
  });
  expect(await screen.findByText("v8 has no text to compare")).toBeDefined();
  expect((await firstRow()).getByText("Approved before: v8")).toBeDefined();
  expect(countsLine().queryByRole("button", { name: "Retry" })).toBeNull();
  expect(document.querySelector("[data-reading-aids-change]")).toBeNull();
});

test("DOC-8 read-first: a failed comparison shows one line with Retry and no marks, and Retry draws them", async () => {
  quietConsoleError();
  const user = userEvent.setup();
  spyOn(InProcessWorker.prototype, "postMessage").mockImplementationOnce(function (
    this: InProcessWorker
  ) {
    this.crash();
  });
  await mount(SPEC_REF, CHANGED, () => [twoDocuments], { earlier: EARLIER });
  expect(await screen.findByText("Could not load the changes.")).toBeDefined();
  expect(document.querySelector("[data-reading-aids-change]")).toBeNull();
  await user.click(countsLine().getByRole("button", { name: "Retry" }));
  expect(
    await screen.findByText(
      "Since v8, the last approved version: 1 block, 1 changed, in 1 of 2 sections"
    )
  ).toBeDefined();
  expect(document.querySelector("[data-reading-aids-change]")).not.toBeNull();
});

test("DOC-9 read-first: off the spec's page the counts line shows, and with no request approved before it has no earlier version", async () => {
  await mount(VERIFICATION_REF, CHANGED, () => [twoDocuments], { earlier: EARLIER });
  expect(await screen.findByText("No earlier version to compare")).toBeDefined();
  expect(document.querySelector("[data-reading-aids-change]")).toBeNull();
});

test("baseline: with no earlier version, Only changes is not offered and its key does nothing", async () => {
  await mount(VERIFICATION_REF, CHANGED, () => [twoDocuments], { earlier: EARLIER });
  expect(await screen.findByText("No earlier version to compare")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Only changes" })).toBeNull();
  expect(commandStore.view("reading-aids.toggle-only-changes")?.enabled).toBe(false);
  expect(document.querySelector(`.${ONLY_CHANGES_FOLD}`)).toBeNull();
});
