// The requests upstream's document page makes with the aids on and with them off.
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fakeDocumentRuntime } from "@upstream-dispatch/__tests__/document-runtime";
import { graphNode } from "@upstream-dispatch/__tests__/graph-fixture";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import {
  answerTextReadsWithTheSeededText,
  artifact,
  createQueryClient,
  documentSurfaceHandlers,
  renderProofDocument,
} from "@upstream-dispatch/__tests__/proof-document";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import { http } from "msw";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { AidParts } from "./aid-parts";
import { HOST_ATTRIBUTE } from "./aided-editor";
import { aVersion, versionText, wait } from "./baseline-page.fixture";
import { inProcessAidedEditor } from "./comparer-fixtures";
import { partsSlot } from "./parts-slot";
import { recordReadMarks } from "./visit";

answerTextReadsWithTheSeededText();

/** The theme's outline tokens, which the outline measures its room by, on the article it measures. */
const tokens = document.createElement("style");
tokens.textContent =
  "article { --reading-outline-width: 200px; --reading-outline-gap: 24px; --reading-measure: 504px; }";

beforeAll(async () => {
  await warmMarkdownRenderer();
  document.head.append(tokens);
});

afterAll(() => tokens.remove());

let forget = () => {};

/** Ends a run's page and its read marks. */
function reset(): void {
  forget();
  forget = () => {};
  cleanup();
  document.body.removeAttribute(HOST_ATTRIBUTE);
}

afterEach(reset);

/** Waits until no request has arrived for 300 ms. */
async function quiet(requests: readonly string[]): Promise<void> {
  let seen = -1;
  while (seen !== requests.length) {
    seen = requests.length;
    await wait(300);
  }
}

/** The issue's spec at v2, which the reader last read at v1. */
const SPEC = { ...artifact, versions: [aVersion(1), aVersion(2)] };

/** Each request the page made, `<METHOD> <path and query>`, sorted, once its reads settle. */
async function pageRequests(aids: boolean): Promise<string[]> {
  const requests: string[] = [];
  answerRequests(
    // Counts each request and leaves it to the handlers below.
    http.all("*", ({ request }) => {
      const { pathname, search } = new URL(request.url);
      requests.push(`${request.method} ${pathname}${search}`);
    }),
    http.get("/api/v1/me/documents/:id/read", ({ params }) =>
      Response.json({ artifact_id: String(params.id), read_at: null, version: 1 })
    ),
    http.get("/api/v1/artifacts/:id/versions/:number", ({ params }) =>
      Response.json({ ...aVersion(Number(params.number)), markdown: versionText(1) })
    ),
    http.get("/api/v1/references", ({ request }) =>
      Response.json({
        edges: [],
        node: graphNode({
          id: new URL(request.url).searchParams.get("to") ?? "",
          kind: "artifact",
        }),
      })
    ),
    ...documentSurfaceHandlers()
  );
  const queryClient = createQueryClient();
  // The issue as upstream's issue page holds it.
  queryClient.setQueryData(["issue", SPEC.issue_key], { artifacts: [SPEC], key: SPEC.issue_key });
  const fake = fakeDocumentRuntime({ text: "The live document." });
  if (aids) {
    // As the aids' host does.
    forget = recordReadMarks(queryClient);
    document.body.setAttribute(HOST_ATTRIBUTE, "");
    fake.runtime.createEditor = inProcessAidedEditor;
  }
  const { sync } = renderProofDocument({ document: SPEC, fake, queryClient });
  await sync();
  // Both runs wait from here, and again after the aids' parts.
  await quiet(requests);
  if (aids) {
    const entry = await waitFor(() => {
      const [first] = partsSlot.entries();
      if (first === undefined) throw new Error("the editor has no aids yet");
      return first;
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryNavigationProvider path={`/issues/${SPEC.issue_key}/spec`}>
          <AidParts entry={entry} shown />
        </MemoryNavigationProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/^Since v1, the version you last read:/)).toBeDefined();
  }
  await quiet(requests);
  return requests.sort();
}

test("aids-reads: with the aids on, the page makes the requests it makes with them off, and one read of the baseline", async () => {
  const off = await pageRequests(false);
  reset();
  const on = await pageRequests(true);
  expect(on).toEqual([...off, `GET /api/v1/artifacts/${SPEC.id}/versions/1`].sort());
});
