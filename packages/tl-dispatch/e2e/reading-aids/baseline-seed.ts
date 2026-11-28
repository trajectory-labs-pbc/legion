// A spec the reader read and an agent revised since, for the baseline's and the marks' tests.
import type { Locator } from "@playwright/test";
import { createIssueArtifact, editArtifact, getArtifact } from "../../../dispatch/e2e/api";
import { documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT } from "../flows";
import { expect, type Page } from "../test";
import { FIRST, openHost, partsRoot, SECOND, type Seeded, seedHost, TEXT } from "./hosts";

type Ops = Parameters<typeof editArtifact>[1]["ops"];

/** The version of the next read mark upstream writes. */
async function nextMarkWritten(page: Page): Promise<number> {
  const response = await page.waitForResponse(
    (each) =>
      each.request().method() === "PUT" &&
      /\/api\/v1\/me\/documents\/[^/]+\/read$/u.test(each.url())
  );
  const written: { version: number } = await response.json();
  return written.version;
}

/** The newest version of the artifact, as the agent reads it. */
const newestVersion = (artifactId: string) => async () =>
  Math.max(...((await getArtifact(artifactId, AGENT)).versions ?? []).map((each) => each.number));

/** The counts line's words for its baseline, with all of its counts. */
export const sinceText = (page: Page, text: string) =>
  partsRoot(page).getByText(text, { exact: true });

/** The added words in `scope`: one run drawn across two authors' text is several `ins`, so joined. */
export const addedWords = (scope: Locator) =>
  scope.locator("ins").evaluateAll((added) => added.map((each) => each.textContent).join(""));

/** A spec of `text` whose first open marks its first version read, then edited by the agent. */
export async function seedEditedSpec(page: Page, text: string, ops: Ops): Promise<Seeded> {
  const spec = await seedHost(page, "spec", text);
  const mark = nextMarkWritten(page);
  await openHost(page, spec.path);
  const read = await mark;
  await editArtifact(spec.artifactId, { ops }, AGENT);
  await expect.poll(newestVersion(spec.artifactId)).toBeGreaterThan(read);
  return spec;
}

/** The counts line's Compare with. */
export const compareWith = (page: Page) =>
  partsRoot(page).getByRole("combobox", { name: "Compare with" });

/** A Compare-with option: upstream's own version picker offers the same names. */
export const versionOption = (page: Page, version: number) =>
  page.getByRole("listbox").getByRole("option", { exact: true, name: `Version ${version}` });

/** Picks `version` in Compare with. */
export async function pickVersion(page: Page, version: number): Promise<void> {
  await compareWith(page).click();
  await versionOption(page, version).click();
}

/** A spec whose first open marks it read, then revised twice by the agent: by `edits`, in order. */
export interface ReadThenRevised {
  /** The issue's other document, where a new visit opens. */
  readonly otherPath: string;
  /** The version the reader's read mark names. */
  readonly read: number;
}

export async function seedReadThenRevised(
  page: Page,
  edits: readonly (readonly [string, string])[] = [
    [FIRST, "The first block, revised."],
    ["The first block, revised.", "The first block, revised twice."],
  ]
): Promise<ReadThenRevised> {
  const spec = await seedHost(page, "spec");
  const issueKey = spec.issueKey ?? "";
  const other = await createIssueArtifact(issueKey, { content: TEXT, name: "notes.md" }, AGENT);

  // The first open writes the reader's read mark at the version it shows.
  const firstMark = nextMarkWritten(page);
  await openHost(page, spec.path);
  const read = await firstMark;
  for (const [find, replacement] of edits) {
    await editArtifact(
      spec.artifactId,
      { ops: [{ find, op: "replace", with: replacement }] },
      AGENT
    );
  }
  await expect.poll(newestVersion(spec.artifactId)).toBeGreaterThanOrEqual(read + 2);
  return { otherPath: `/issues/${issueKey}/artifacts/${other.artifact.slug}`, read };
}

/** A new visit from the issue's other document to the spec; the version upstream then marks read. */
export async function revisitSpec(page: Page, seeded: ReadThenRevised): Promise<number> {
  await openHost(page, seeded.otherPath);
  const mark = nextMarkWritten(page);
  await page.getByRole("tab", { name: "Spec" }).click();
  await expect(documentEditor(page)).toContainText(SECOND);
  return mark;
}
