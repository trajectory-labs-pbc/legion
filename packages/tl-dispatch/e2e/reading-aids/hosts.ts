// The seed and the locators the reading aids' browser tests share.
import { randomUUID } from "node:crypto";

import {
  createArtifactComment,
  createComment,
  createIssue,
  createProjectDocument,
} from "../../../dispatch/e2e/api";
import { connectedDot, documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT, personOf, runProject } from "../flows";
import { expect, type Page, runName } from "../test";

/** Any parts' root, which `editor-aids.ts` marks. */
export const PARTS = "[data-reading-aids-parts]";

/** The parts' root of the page's document editor, which `editor-aids.ts` marks. */
export const partsRoot = (page: Page) => documentEditor(page).locator(PARTS);

/** How many parts' roots the page shows, anywhere: a hidden editor's root is not shown. */
export const shownParts = (page: Page) =>
  page
    .locator(PARTS)
    .evaluateAll(
      (roots) => roots.filter((root) => root.checkVisibility({ visibilityProperty: true })).length
    );

export const FIRST = "The first block of the document.";
export const SECOND = "The second block, which a comment names.";
export const THIRD = "The third block.";
export const TEXT = `${FIRST}\n\n${SECOND}\n\n${THIRD}\n`;
const QUOTE = "which a comment names";

/** A title or a file name of this run that no other test takes. */
export const uniqueName = (what: string) => `${runName} ${what} ${randomUUID().slice(0, 8)}`;

export type HostKind = "spec" | "document";

export interface Seeded {
  path: string;
  artifactId: string;
  issueKey?: string;
}

/** A document on a host, with a comment on its second block, and the path that opens it. */
export async function seedHost(page: Page, kind: HostKind, text = TEXT): Promise<Seeded> {
  const project = (await runProject(await personOf(page))).key;
  const body = "A comment on the second block.";
  if (kind === "spec") {
    // Forced, as upstream's seeds are: the run's issues are near copies of each other on purpose.
    const issue = await createIssue(
      { force: true, project, spec: text, title: uniqueName("aids") },
      AGENT
    );
    await createComment(issue.key, { anchor: { artifact: "spec", quote: QUOTE }, body }, AGENT);
    return {
      artifactId: issue.primary_artifact_id ?? "",
      issueKey: issue.key,
      path: `/issues/${issue.key}/spec`,
    };
  }
  const { artifact } = await createProjectDocument(
    project,
    { content: text, name: `${uniqueName("aids").replaceAll(" ", "-")}.md` },
    AGENT
  );
  await createArtifactComment(
    artifact.id,
    { anchor: { artifact: artifact.slug, quote: QUOTE }, body },
    AGENT
  );
  return { artifactId: artifact.id, path: `/projects/${project}/documents/${artifact.slug}` };
}

/** Opens a host's document and waits until its editor shows `text` and is connected. */
export async function openHost(page: Page, path: string, text = SECOND): Promise<void> {
  await page.goto(path);
  await expect(documentEditor(page)).toContainText(text);
  await expect(connectedDot(page)).toHaveText("connected");
}
