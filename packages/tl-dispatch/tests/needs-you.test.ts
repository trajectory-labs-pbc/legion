import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT, sourceFiles, UPSTREAM_WEB } from "./source";

const scripts = sourceFiles().filter((file) => /\.[cm]?[jt]sx?$/.test(file.path));
const naming = (pattern: RegExp) =>
  scripts.filter((file) => pattern.test(file.text)).map((file) => file.path);

test("only features/needs-you imports AttentionMark", () => {
  const importers = naming(/@legion\/ui\/components\/attention-mark/);
  expect(importers).not.toHaveLength(0);
  expect(importers.filter((path) => !path.startsWith("src/features/needs-you/"))).toEqual([]);
});

test("no script names the warning colour: the mark is the only way to draw it", () => {
  expect(naming(/\bwarning\b/i)).toEqual([]);
});

/** The queries and hooks `name`'s body in `file` calls, `useQuery` aside: the reads it makes. */
function readsOf(file: string, name: string): string[] {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf("{", text.indexOf(`export function ${name}(`));
  const body = text.slice(start, text.indexOf("\n}\n", start));
  return [...body.matchAll(/\b(\w+)\(/g)]
    .map((call) => call[1] ?? "")
    .filter((call) => call !== "useQuery" && (call.endsWith("Query") || call.startsWith("use")));
}

test("the Inbox count reads what upstream's needs-you count reads, so a new read fails here", () => {
  expect(
    readsOf(join(UPSTREAM_WEB, "features/inbox/BlockedOnYou.tsx"), "useNeedsYouCount")
  ).toEqual(["inboxQuery", "whoAmIQuery", "useCredentialRequests"]);
  expect(
    readsOf(join(UPSTREAM_WEB, "features/credentials/pending.ts"), "useCredentialRequests")
  ).toContain("credentialPendingQuery");
  const ours = readsOf(join(PACKAGE_ROOT, "src/shell/inbox-count.ts"), "useInboxRowCount");
  for (const read of ["inboxQuery", "whoAmIQuery", "credentialPendingQuery"]) {
    expect(ours).toContain(read);
  }
});
