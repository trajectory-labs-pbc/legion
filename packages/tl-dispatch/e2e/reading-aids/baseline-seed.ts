// A spec the reader read and an agent revised since, for the baseline's browser tests.
import { createIssueArtifact, editArtifact, getArtifact } from "../../../dispatch/e2e/api";
import { documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT } from "../flows";
import { expect, type Page } from "../test";
import { FIRST, openHost, partsRoot, SECOND, seedHost, TEXT } from "./hosts";

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

export const sinceText = (page: Page, text: string) =>
  partsRoot(page).getByText(text, { exact: true });

/** The counts line's Compare with. */
export const compareWith = (page: Page) =>
  partsRoot(page).getByRole("combobox", { name: "Compare with" });

/** A spec whose first open marks it read, then revised twice by the agent. */
export interface ReadThenRevised {
  /** The issue's other document, where a new visit opens. */
  readonly otherPath: string;
  /** The version the reader's read mark names. */
  readonly read: number;
}

export async function seedReadThenRevised(page: Page): Promise<ReadThenRevised> {
  const spec = await seedHost(page, "spec");
  const issueKey = spec.issueKey ?? "";
  const other = await createIssueArtifact(issueKey, { content: TEXT, name: "notes.md" }, AGENT);

  // The first open writes the reader's read mark at the version it shows.
  const firstMark = nextMarkWritten(page);
  await openHost(page, spec.path);
  const read = await firstMark;
  for (const [find, replacement] of [
    [FIRST, "The first block, revised."],
    ["The first block, revised.", "The first block, revised twice."],
  ] as const) {
    await editArtifact(
      spec.artifactId,
      { ops: [{ find, op: "replace", with: replacement }] },
      AGENT
    );
  }
  await expect
    .poll(async () =>
      Math.max(
        ...((await getArtifact(spec.artifactId, AGENT)).versions ?? []).map((each) => each.number)
      )
    )
    .toBeGreaterThanOrEqual(read + 2);
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
