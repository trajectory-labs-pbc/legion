import { expect, test } from "bun:test";
import type { IssueDetails } from "@/upstream/contract";

import { aidedDocument } from "./document-reads";

type IssueArtifact = NonNullable<IssueDetails["artifacts"]>[number];

const artifact = (fields: Pick<IssueArtifact, "id" | "slug" | "primary" | "kind">) =>
  fields as IssueArtifact;

const ISSUE = {
  artifacts: [
    artifact({ id: "a-plan", kind: "doc", primary: false, slug: "plan-md" }),
    artifact({ id: "a-spec", kind: "doc", primary: true, slug: "spec" }),
    artifact({ id: "a-check", kind: "doc", primary: false, slug: "verification-md" }),
  ],
};
const PROJECT_DOCUMENT = { id: "a-notes", slug: "notes-md" };

test.each([
  ["dispatch://CORE-1/spec", "a-spec", "spec"],
  ["dispatch://CORE-1/artifact/verification-md", "a-check", "verification-md"],
])("%s names its issue's document", (documentRef, artifactId, slug) => {
  expect(aidedDocument(documentRef, ISSUE, undefined)).toEqual({
    artifactId,
    owner: { key: "CORE-1", kind: "issue" },
    slug,
  });
});

test("a project document's reference names the project's document read", () => {
  expect(aidedDocument("dispatch://CORE/artifact/notes-md", undefined, PROJECT_DOCUMENT)).toEqual({
    artifactId: "a-notes",
    owner: { kind: "project", project: "CORE" },
    slug: "notes-md",
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
