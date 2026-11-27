// A host page's reads of the baseline, on the fake network, for the aids' tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import type { Ask, Version } from "@upstream-dispatch/api/types";
import { http } from "msw";
import type { ReactNode } from "react";

import { CountsLine } from "./counts-line";
import type { AidedDocument } from "./reads";
import { type BaselineRead, useBaseline } from "./use-baseline";
import { recordReadMarks } from "./visit";

const cleanups: (() => void)[] = [];

/** Takes down each page the test made: give it to `afterEach`. */
export function endPages(): void {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
}

export const aVersion = (number: number): Version => ({
  authors: [],
  created_at: "2026-11-01T00:00:00Z",
  named: false,
  number,
  summary: null,
});

let made = 0;

/** A document of its own visit: each test's id is new, as a reload's visit is. */
export function aDocument(readsMark = true, numbers = [16, 12, 8, 4]): AidedDocument {
  made += 1;
  return {
    artifactId: `baseline-${made}`,
    owner: { key: `CORE-${made}`, kind: "issue" },
    picker: "spec",
    readsMark,
    slug: "spec",
    versions: numbers.map(aVersion),
  };
}

export const versionText = (version: number) => `The text of version ${version}.`;

/** Lets `ms` pass, with React's updates in it. */
export const wait = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

/** The line's Compare with. */
export const compareWith = () => screen.getByRole("combobox", { name: "Compare with" });

/** Picks the version named `name` under Compare with. */
export async function pick(name: string): Promise<void> {
  await userEvent.click(compareWith());
  await userEvent.click(await screen.findByRole("option", { name }));
}

const failure = () => Response.json({ code: "INTERNAL", error: "down" }, { status: 500 });
const refused = (status: 403 | 404) =>
  Response.json({ code: status === 403 ? "FORBIDDEN" : "NOT_FOUND", error: "no" }, { status });

/** The requests the page's fake network answered. */
interface Asked {
  asks: number;
  marks: number;
  /** Each version read, in order. */
  versions: number[];
  writes: number;
}

/** A host page on a fake network, whose options shape each asks, read-mark and version answer. */
export function page(
  document: AidedDocument,
  {
    asks,
    blob = [],
    brokenOnce = [],
    forbidden = [],
    gcTime,
    held = [],
    holdMarks = false,
    markFails = 0,
    markRefusal,
    missing = [],
    read = null,
    retry,
    staleTime,
    unavailable = [],
    versionFails = 0,
    wrap = (children) => children,
  }: {
    /** Each asks read's answer in turn, or a 500 for "fail"; the last one stays. */
    asks: (Ask[] | "fail")[];
    /** Versions that are a file, with no text. */
    blob?: readonly number[];
    /** Versions whose first read answers 500. */
    brokenOnce?: readonly number[];
    /** Versions the reader may not see: each read answers 403. */
    forbidden?: readonly number[];
    /** The page's default `gcTime`, for a test that waits for a read to leave the cache. */
    gcTime?: number;
    /** Versions whose reads each wait for one `release`. */
    held?: readonly number[];
    /** Whether the read-mark reads each wait for one `release` too. */
    holdMarks?: boolean;
    /** How many read-mark reads answer 500 before the read mark answers. */
    markFails?: number;
    /** The refusal the read mark answers with, after `markFails`, in place of `read`. */
    markRefusal?: 403 | 404;
    /** Versions that are not found: each read answers 404. */
    missing?: readonly number[];
    /** The read mark's version, or null for none. */
    read?: number | null;
    /** The page's retry rule, as the app sets one; each retry comes at once. */
    retry?: (failureCount: number, error: unknown) => boolean;
    /** The page's default `staleTime`, as the app sets one. */
    staleTime?: number;
    /** Versions whose every read answers 503. */
    unavailable?: readonly number[];
    /** How many reads of a version with text answer 500 before it answers. */
    versionFails?: number;
    wrap?: (children: ReactNode) => ReactNode;
  }
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        ...(retry === undefined ? { retry: false } : { retry, retryDelay: 0 }),
        ...(gcTime === undefined ? {} : { gcTime }),
        ...(staleTime === undefined ? {} : { staleTime }),
      },
    },
  });
  cleanups.push(recordReadMarks(queryClient));
  // Each release lets one held read through: the one waiting, else the next to come.
  const waiting: (() => void)[] = [];
  let released = 0;
  const release = () => {
    const next = waiting.shift();
    if (next === undefined) released += 1;
    else next();
  };
  const hold = async () => {
    if (released > 0) {
      released -= 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  const answers = [...asks];
  const asked: Asked = { asks: 0, marks: 0, versions: [], writes: 0 };
  const broken = new Set(brokenOnce);
  let failing = versionFails;
  let markFailing = markFails;
  const asksPath =
    document.owner.kind === "issue"
      ? `/api/v1/issues/${document.owner.key}/asks`
      : `/api/v1/artifacts/${document.artifactId}/asks`;
  answerRequests(
    http.get(asksPath, () => {
      asked.asks += 1;
      const answer = answers.length > 1 ? answers.shift() : answers[0];
      return answer === "fail" || answer === undefined ? failure() : Response.json(answer);
    }),
    http.get(`/api/v1/me/documents/${document.artifactId}/read`, async () => {
      asked.marks += 1;
      if (holdMarks) await hold();
      if (markFailing > 0) {
        markFailing -= 1;
        return failure();
      }
      if (markRefusal !== undefined) return refused(markRefusal);
      return Response.json({ artifact_id: document.artifactId, read_at: null, version: read });
    }),
    http.put<never, { version: number }>(
      `/api/v1/me/documents/${document.artifactId}/read`,
      async ({ request }) => {
        asked.writes += 1;
        const sent = await request.json();
        return Response.json({
          artifact_id: document.artifactId,
          read_at: null,
          version: sent.version,
        });
      }
    ),
    http.get(`/api/v1/artifacts/${document.artifactId}/versions/:number`, async ({ params }) => {
      const number = Number(params.number);
      asked.versions.push(number);
      if (held.includes(number)) await hold();
      if (missing.includes(number)) return refused(404);
      if (forbidden.includes(number)) return refused(403);
      if (unavailable.includes(number)) {
        return Response.json({ code: "UNAVAILABLE", error: "try later" }, { status: 503 });
      }
      if (blob.includes(number)) {
        return new Response("%PDF", { headers: { "Content-Type": "application/pdf" } });
      }
      if (failing > 0 || broken.delete(number)) {
        failing = Math.max(0, failing - 1);
        return failure();
      }
      return Response.json({ ...aVersion(number), markdown: versionText(number) });
    })
  );
  let latest: BaselineRead | undefined;
  function Probe() {
    latest = useBaseline(document);
    return <CountsLine read={latest} />;
  }
  return {
    asked,
    queryClient,
    read: () => latest,
    /** Lets one held read through. */
    release,
    /** The editor is made: its parts mount. */
    mount: () => {
      const view = render(
        <QueryClientProvider client={queryClient}>
          {wrap(
            <>
              <p>The document.</p>
              <Probe />
            </>
          )}
        </QueryClientProvider>
      );
      cleanups.push(() => view.unmount());
      return view;
    },
  };
}
