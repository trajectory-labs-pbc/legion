// The seed and the locators the reading aids' browser tests share.
import { randomUUID } from "node:crypto";
import type { Locator } from "@playwright/test";

import {
  createArtifactComment,
  createComment,
  createIssue,
  createProjectDocument,
  getArtifactBlocks,
  getArtifactText,
} from "../../../dispatch/e2e/api";
import { connectedDot, documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT, personOf, runProject } from "../flows";
import { expect, type Page, runName } from "../test";

/** Any parts' root, which `editor-aids.ts` marks. */
export const PARTS = "[data-reading-aids-parts]";

/** The element around a host page, which `hosts.tsx` marks. */
export const HOST = "[data-reading-aids-host]";

/** The parts' root of the page's document editor, which `editor-aids.ts` marks. */
export const partsRoot = (page: Page) => documentEditor(page).locator(PARTS);

/** The counts line, which holds the aids' controls. */
export const countsLine = (page: Page) => partsRoot(page).locator("[data-reading-aids-counts]");

/** The fold head's button of the block `blockId`, which `fold-head.ts` marks. */
export const head = (page: Page, blockId: string) =>
  page.locator(`[data-reading-aids-fold-head="${blockId}"] button`);

/** The id of the block whose text is `text`, from the server's own block list. */
export async function blockIdOf(artifactId: string, text: string): Promise<string> {
  const { markdown } = await getArtifactText(artifactId, AGENT);
  const blocks = await getArtifactBlocks(artifactId, AGENT);
  const block = blocks.find(({ from, to }) => markdown.slice(from, to) === text);
  if (block === undefined) throw new Error(`no block reads ${JSON.stringify(text)}`);
  return block.id;
}

/** How many parts' roots the page shows, anywhere: a hidden editor's root is not shown. */
export const shownParts = (page: Page) =>
  page
    .locator(PARTS)
    .evaluateAll(
      (roots) => roots.filter((root) => root.checkVisibility({ visibilityProperty: true })).length
    );

/** The box of the one element `locator` finds; it throws while none is drawn. */
export async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error(`${locator} has no box`);
  return found;
}

export const top = async (locator: Locator) => (await box(locator)).y;

export const bottom = async (locator: Locator) => {
  const { height, y } = await box(locator);
  return y + height;
};

/** Puts the focus on the host as the aids' move does, which alone makes it focusable. */
export async function focusHost(page: Page): Promise<void> {
  const host = page.locator(HOST);
  await host.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("the host is no HTML element");
    element.tabIndex = -1;
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
    element.focus({ preventScroll: true });
  });
  await expect(host).toBeFocused();
}

/** Waits until the animations running on `locator`, such as its transitions, have ended. */
export async function transitionsEnded(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );
}

/** How far apart the tops of two elements are, once both are drawn. */
export async function topsApart(first: Locator, second: Locator): Promise<number | null> {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  return a === null || b === null ? null : Math.abs(a.y - b.y);
}

/** How far the page's one block reference counter is from its block's top, once both are drawn. */
export async function counterOffset(page: Page): Promise<number | null> {
  const counter = page.locator("[data-block-references]");
  const blockId = await counter.getAttribute("data-block-references");
  return topsApart(counter, documentEditor(page).locator(`[data-block-id="${blockId}"]`).first());
}

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
