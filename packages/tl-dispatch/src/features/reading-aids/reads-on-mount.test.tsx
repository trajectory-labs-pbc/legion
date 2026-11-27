import { afterEach, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";

import { render, sleep } from "../../../tests/react";
import { type AidedDocument, useAidedDocument, useAsksRead } from "./reads";

/** The app's staleTime, which upstream's shell sets. */
const STALE_MS = 30_000;
const LONG_AGO = { updatedAt: Date.now() - STALE_MS - 1_000 };

const ISSUE_DOCUMENT: AidedDocument = {
  artifactId: "a-spec",
  owner: { key: "CORE-1", kind: "issue" },
  slug: "spec",
};
const PROJECT_DOCUMENT: AidedDocument = {
  artifactId: "a-notes",
  owner: { kind: "project", project: "CORE" },
  slug: "notes-md",
};

const unexpected = () => Promise.reject(new Error("A read the page does not make."));
let spies: { mock: { calls: unknown[] }; mockRestore(): void }[] = [];

afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
  document.body.replaceChildren();
});

function Parts({ documentRef, document }: { documentRef: string; document: AidedDocument }) {
  useAidedDocument(documentRef);
  useAsksRead(document);
  return null;
}

/** A read's key and a minimal answer of its shape, as upstream's page holds it. */
type Seed = readonly [key: readonly unknown[], answer: unknown];

/** How many reads go out as the parts mount over `seeded`, the answers upstream's page holds. */
async function readsOnMount(
  documentRef: string,
  document: AidedDocument,
  seeded: readonly Seed[]
): Promise<number> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: STALE_MS } },
  });
  for (const [key, answer] of seeded) queryClient.setQueryData(key, answer, LONG_AGO);
  spies = [
    spyOn(api, "getIssue").mockImplementation(unexpected),
    spyOn(api, "getProjectArtifact").mockImplementation(unexpected),
    spyOn(api, "listIssueAsks").mockImplementation(unexpected),
    spyOn(api, "listArtifactAsks").mockImplementation(unexpected),
  ];
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Parts document={document} documentRef={documentRef} />
    </QueryClientProvider>
  );
  await sleep(20);
  const count = spies.reduce((total, spy) => total + spy.mock.calls.length, 0);
  view.unmount();
  return count;
}

test.each<[string, string, AidedDocument, readonly Seed[]]>([
  [
    "an issue's",
    "dispatch://CORE-1/spec",
    ISSUE_DOCUMENT,
    [
      [["issue", "CORE-1"], { artifacts: [] }],
      [["asks", "CORE-1"], []],
    ],
  ],
  [
    "a project's",
    "dispatch://CORE/artifact/notes-md",
    PROJECT_DOCUMENT,
    [
      [["artifact-ref", "CORE/notes-md"], { id: "a-notes", slug: "notes-md" }],
      [["artifact", "a-notes", "asks"], []],
    ],
  ],
])("the parts' reads of %s document send nothing over answers past their staleTime", async (_kind, documentRef, document, seeded) => {
  expect(await readsOnMount(documentRef, document, seeded)).toBe(0);
});

test("a read with no answer yet still loads as the parts mount", async () => {
  expect(await readsOnMount("dispatch://CORE-1/spec", ISSUE_DOCUMENT, [])).toBe(2);
});
