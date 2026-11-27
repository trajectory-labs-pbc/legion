import { afterEach, beforeAll, expect, mock, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commandStore } from "@/commands/command-store";
import { api } from "@/upstream/api";
import type { IssueAskRow, IssueDetails } from "@/upstream/contract";
import type { ConnectionCallbacks, DocumentConnection } from "@/upstream/editor/frame";
import { actorLabelText, buildDispatchReference } from "@/upstream/logic/reading-aids";
import { MemoryNavigationProvider } from "../../../tests/navigation";
import { refusal } from "../../../tests/network";
import { blockIdsOf, destroyEditors, editorIn } from "../../../tests/reading-aids/editor-fixtures";
import { warmMarkdownRenderer } from "../../../tests/upstream";
import { AidParts } from "./aid-parts";
import { HOST_ATTRIBUTE } from "./aided-editor";
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

/** Mounts an aided editor and its parts, its document synced unless `synced` is false. */
async function mount(
  documentRef: string,
  markdown: string,
  asks: (blocks: readonly string[]) => IssueAskRow[],
  {
    issueRead = Promise.resolve(issue),
    synced = true,
  }: { issueRead?: Promise<IssueDetails>; synced?: boolean } = {}
) {
  const host = document.body.appendChild(document.createElement("div"));
  host.setAttribute(HOST_ATTRIBUTE, "");
  host.tabIndex = -1;
  const handle = await editorIn(host.appendChild(document.createElement("div")), documentRef);
  handle.setMarkdown(markdown);
  const blocks = blockIdsOf(handle.view);
  const sync = connect(documentRef === VERIFICATION_REF ? VERIFICATION : SPEC);
  if (synced) sync();
  const entry = partsSlot.entries().find((each) => each.editor === handle);
  if (entry === undefined) throw new Error("the editor got no aids");
  spyOn(api, "getIssue").mockReturnValue(issueRead);
  const asksRead = spyOn(api, "listIssueAsks").mockImplementation(async () => asks(blocks));
  // The counts line's read of the version a request approved.
  spyOn(api, "getArtifactVersion").mockImplementation(async (_id, number) => ({
    authors: [],
    created_at: "2026-11-20T10:00:00Z",
    markdown,
    named: false,
    number,
    summary: null,
  }));
  const focusBlock = spyOn(handle, "focusBlock").mockImplementation(() => {});
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryNavigationProvider path={`/issues/${KEY}/spec`}>
        <AidParts entry={entry} shown />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  const refresh = () => act(() => queryClient.invalidateQueries({ queryKey: ["asks", KEY] }));
  return { asksRead, blocks, focusBlock, host, refresh, sync };
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
      throw refusal(status);
    });
    expect(await (await readFirst()).findByText(words)).toBeDefined();
    expect((await readFirst()).queryByRole("button", { name: "Retry" })).toBeNull();
  });
}

test("read-first: a request that waits on the reader with no person named says it waits on you", async () => {
  await mount(SPEC_REF, "Text.", () => [{ ...twoDocuments, waiting_on_person: "" } as IssueAskRow]);
  expect((await firstRow()).getByText("Waiting on you")).toBeDefined();
});
