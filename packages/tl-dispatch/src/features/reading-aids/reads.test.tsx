// The document the host's reads name, and the requests the aids add to a host page.
import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { details } from "@upstream-dispatch/__tests__/issue-picks";
import { api } from "@upstream-dispatch/api/client";
import type { IssueDetails } from "@upstream-dispatch/api/types";
import { parseNodeReference } from "@upstream-dispatch/features/refs/routes";
import { Component, type ReactNode } from "react";

import { readRetry } from "@/features/read-failure";

import { approvalAsk, at } from "./approval-asks.fixture";
import { aDocument, aVersion, endPages, page, pick, wait } from "./baseline-page.fixture";
import { type AidedDocument, aidedDocument as aidedDocumentOf, useAidedDocument } from "./reads";

afterEach(endPages);

/** The page's error boundary: a read that throws to it hides the document. */
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <p>This page could not load.</p> : this.props.children;
  }
}

/** Upstream's own asks read of the document, as `ProofDocument` makes it. */
function UpstreamAsksRead({ document }: { document: AidedDocument }) {
  useQuery({
    queryFn: () => api.listArtifactAsks(document.artifactId),
    queryKey: ["artifact", document.artifactId, "asks"],
  });
  return null;
}

/** Upstream's own read of one version, as the version view makes it, with a short `gcTime`. */
function UpstreamVersionRead({ document, version }: { document: AidedDocument; version: number }) {
  useQuery({
    gcTime: 10,
    queryFn: () => api.getArtifactVersion(document.artifactId, version),
    queryKey: ["artifact", document.artifactId, "version", version],
  });
  return null;
}

type IssueArtifact = NonNullable<IssueDetails["artifacts"]>[number];

const artifact = (fields: Pick<IssueArtifact, "id" | "slug" | "primary" | "kind">) =>
  ({ ...fields, versions: [aVersion(1), aVersion(2)] }) as IssueArtifact;

type Reads = Parameters<typeof aidedDocumentOf>;

/** The document `documentRef` names, parsed as the host parses it. */
const aidedDocument = (documentRef: string, issue: Reads[1], projectDocument: Reads[2]) =>
  aidedDocumentOf(parseNodeReference(documentRef), issue, projectDocument);

const ISSUE = {
  artifacts: [
    artifact({ id: "a-plan", kind: "doc", primary: false, slug: "plan-md" }),
    artifact({ id: "a-spec", kind: "doc", primary: true, slug: "spec" }),
    artifact({ id: "a-check", kind: "doc", primary: false, slug: "verification-md" }),
  ],
};
const PROJECT_DOCUMENT = { id: "a-notes", slug: "notes-md", versions: [aVersion(1)] };

test.each<[string, string, string, boolean, AidedDocument["picker"]]>([
  ["dispatch://CORE-1/spec", "a-spec", "spec", true, "spec"],
  ["dispatch://CORE-1/artifact/verification-md", "a-check", "verification-md", false, "artifact"],
])("%s names its issue's document", (documentRef, artifactId, slug, readsMark, picker) => {
  expect(aidedDocument(documentRef, ISSUE, undefined)).toEqual({
    artifactId,
    owner: { key: "CORE-1", kind: "issue" },
    picker,
    readsMark,
    slug,
    versions: [aVersion(2), aVersion(1)],
  });
});

test("a project document's reference names the project's document read", () => {
  expect(aidedDocument("dispatch://CORE/artifact/notes-md", undefined, PROJECT_DOCUMENT)).toEqual({
    artifactId: "a-notes",
    owner: { kind: "project", project: "CORE" },
    picker: "artifact",
    readsMark: false,
    slug: "notes-md",
    versions: [aVersion(1)],
  });
});

test.each([
  ["the issue read has not answered", "dispatch://CORE-1/spec", undefined, undefined],
  ["the issue has no such document", "dispatch://CORE-1/artifact/gone-md", ISSUE, undefined],
  [
    "the project's read is of another document",
    "dispatch://CORE/artifact/other-md",
    undefined,
    PROJECT_DOCUMENT,
  ],
  ["the reference names no document", "dispatch://CORE-1", ISSUE, PROJECT_DOCUMENT],
])("no document while %s", (_case, documentRef, issue, projectDocument) => {
  expect(aidedDocument(documentRef, issue, projectDocument)).toBeUndefined();
});

test("the asks read is upstream's own, read once, and nothing polls it", async () => {
  const document: AidedDocument = {
    ...aDocument(false),
    owner: { kind: "project", project: "CORE" },
  };
  const visit = page(document, {
    asks: [[]],
    wrap: (children) => (
      <>
        <UpstreamAsksRead document={document} />
        {children}
      </>
    ),
  });
  visit.mount();
  expect(await screen.findByText("No earlier version to compare")).toBeDefined();
  const query = visit.queryClient
    .getQueryCache()
    .find({ exact: true, queryKey: ["artifact", document.artifactId, "asks"] });
  expect(query?.observers.length).toBe(2);
  expect(query?.observers.map((observer) => observer.options.refetchInterval)).toEqual([
    undefined,
    undefined,
  ]);
  await wait(300);
  expect(visit.asked.asks).toBe(1);
});

test("the aids make no read-mark read and no write: on a plan's page, none at all", async () => {
  const document = { ...aDocument(false), slug: "plan" };
  const visit = page(document, { asks: [[]] });
  visit.mount();
  expect(await screen.findByText("No earlier version to compare")).toBeDefined();
  await wait(50);
  expect(visit.asked).toMatchObject({ marks: 0, writes: 0 });
});

test("one version read per baseline: an invalidation and a return to it read nothing again", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  const visit = page(document, { asks: [[request]] });
  visit.mount();
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  await act(() =>
    visit.queryClient.invalidateQueries({ queryKey: ["artifact", document.artifactId] })
  );
  await wait(50);
  expect(visit.asked.versions).toEqual([8]);

  await pick("Version 12");
  expect(await screen.findByText("Since v12")).toBeDefined();
  await pick("Version 8");
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  expect(visit.asked.versions).toEqual([8, 12]);
});

test("a version upstream read first is not read again after upstream's read leaves the cache", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  let upstream = true;
  const visit = page(document, {
    asks: [[request]],
    wrap: (children) => (
      <>
        {upstream ? <UpstreamVersionRead document={document} version={8} /> : null}
        {children}
      </>
    ),
  });
  const first = visit.mount();
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  expect(visit.asked.versions).toEqual([8]);
  first.unmount();
  upstream = false;
  const versionKey = ["artifact", document.artifactId, "version", 8];
  await waitFor(() => expect(visit.queryClient.getQueryState(versionKey)).toBeUndefined());

  visit.mount();
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  await wait(50);
  expect(visit.asked.versions).toEqual([8]);
});

test("a pick returned to after the page's gc time reads nothing", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  const visit = page(document, { asks: [[request]], gcTime: 10 });
  visit.mount();
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  for (const [name, since] of [
    ["Version 12", "Since v12"],
    ["Version 4", "Since v4"],
  ]) {
    await pick(name);
    expect(await screen.findByText(since)).toBeDefined();
  }
  const upstreamKey = ["artifact", document.artifactId, "version", 12];
  await waitFor(() => expect(visit.queryClient.getQueryState(upstreamKey)).toBeUndefined());
  await pick("Version 12");
  expect(await screen.findByText("Since v12")).toBeDefined();
  expect(visit.asked.versions).toEqual([8, 12, 4]);
});

test("an invalidation of every read reads no version again, nor does a part that mounts after it", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  const visit = page(document, { asks: [[request]], gcTime: 10 });
  visit.mount();
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  const upstreamKey = ["artifact", document.artifactId, "version", 8];
  await waitFor(() => expect(visit.queryClient.getQueryState(upstreamKey)).toBeUndefined());
  await act(() => visit.queryClient.invalidateQueries());
  visit.mount();
  expect(await screen.findAllByText("Since v8, the last approved version")).toHaveLength(2);
  await wait(50);
  expect(visit.asked.versions).toEqual([8]);
});

test("a version read that the server keeps failing is asked as often as upstream asks it", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  const visit = page(document, { asks: [[request]], retry: readRetry, unavailable: [8] });
  visit.mount();
  expect(await screen.findByText("Could not load the changes.")).toBeDefined();
  await wait(50);
  // The first read and the two retries the app's readRetry allows.
  expect(visit.asked.versions).toEqual([8, 8, 8]);
});

test("the document's versions are upstream's fresher read of it, newest first", () => {
  const spec = {
    created_at: "2026-11-01T00:00:00Z",
    created_by: { id: "agent", kind: "session" },
    id: "fresher-spec",
    issue_key: "CORE-1",
    kind: "doc",
    name: "spec.md",
    primary: true,
    project: "CORE",
    ref_key: "CORE-1",
    session_id: null,
    slug: "spec",
    versions: [aVersion(1)],
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(["issue", "CORE-1"], { ...details, artifacts: [spec] });
  queryClient.setQueryData(["artifact", spec.id], {
    ...spec,
    versions: [aVersion(1), aVersion(2)],
  });
  const { result, unmount } = renderHook(() => useAidedDocument("dispatch://CORE-1/spec"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  expect(result.current?.versions.map(({ number }) => number)).toEqual([2, 1]);
  unmount();
});

test("a failed baseline read shows Retry in the line and hides nothing", async () => {
  const document = aDocument(false);
  const request = approvalAsk(at(document.artifactId, 16), { approved: 8 });
  const visit = page(document, {
    asks: [[request]],
    versionFails: 1,
    wrap: (children) => <PageBoundary>{children}</PageBoundary>,
  });
  visit.mount();
  expect(await screen.findByText("Could not load the changes.")).toBeDefined();
  expect(screen.getByText("The document.")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Since v8, the last approved version")).toBeDefined();
  await waitFor(() => expect(visit.asked.versions).toEqual([8, 8]));
});
