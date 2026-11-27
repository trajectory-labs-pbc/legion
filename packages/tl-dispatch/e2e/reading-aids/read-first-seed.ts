// A host's document with three decisions and an approval request, for Read first's tests.
import { randomUUID } from "node:crypto";
import { createIssue, createIssueArtifact, requestApproval } from "../../../dispatch/e2e/api";
import { documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT, personOf, runProject } from "../flows";
import { expect, type Page } from "../test";
import {
  FIRST,
  HOST,
  type HostKind,
  partsRoot,
  SECOND,
  type Seeded,
  seedHost,
  uniqueName,
} from "./hosts";

/** The two hosts, each a test of its own. */
export const HOST_KINDS = ["spec", "document"] as const satisfies readonly HostKind[];

/** The agent that asks for the approval. */
const ARCHITECT = {
  actor: { id: "reading-aids-seed", kind: "session", origin: { session_title: "Architect" } },
  as: "agent",
} as const;

/** The seeded decisions, each named by a key its seed makes into a block id of its own. */
export const DECISIONS = [
  { key: "region-decision", question: "Which region goes first?" },
  { key: "ship-decision", question: "Ship the new reader now?" },
  { key: "api-decision", question: "Keep the old API for a release?" },
] as const;

export interface Decision {
  readonly id: string;
  readonly question: string;
}

/** One seed's decisions, with block ids no earlier document of the run holds. */
const seedDecisions = (): readonly [Decision, Decision, Decision] => {
  const own = ({ key, question }: (typeof DECISIONS)[number]) => ({
    id: `${key}-${randomUUID().slice(0, 8)}`,
    question,
  });
  return [own(DECISIONS[0]), own(DECISIONS[1]), own(DECISIONS[2])];
};

/** The markdown of an open decision block. */
export const decisionMarkdown = ({ id, question }: Decision) =>
  `:::ask{#${id} urgency="med" multiple="false" state="open"}\n${question}\n\n- Yes: Do it\n- No: Not yet\n:::\n`;

/** Enough paragraphs between two decisions that one is out of view while the reader is at the other. */
const FILLER = Array.from(
  { length: 24 },
  (_, at) => `A paragraph of context, number ${at + 1}, that keeps the decisions apart.`
).join("\n\n");

export const LAST = "The last paragraph.";

/** The link to another issue that the text holds, whose hover card names that issue. */
export const LINK = "the other issue";

/** The document's text, with a link to the issue `target`. */
const decidedText = (target: string, decisions: readonly [Decision, Decision, Decision]) =>
  [
    FIRST,
    decisionMarkdown(decisions[0]),
    SECOND,
    FILLER,
    decisionMarkdown(decisions[1]),
    FILLER,
    decisionMarkdown(decisions[2]),
    `See [${LINK}](dispatch://${target}) for context.`,
    LAST,
  ].join("\n\n");

/** The region the parts draw "Read first" in. */
export const readFirst = (page: Page) =>
  partsRoot(page).getByRole("region", { name: "Read first" });

/** The decision block `id` of the page's document. */
export const decisionBlock = (page: Page, id: string) =>
  documentEditor(page).locator(`[data-dispatch-ask-block="${id}"]`);

/** The ask card upstream draws in the decision block `id`. */
export const decisionCard = (page: Page, id: string) =>
  decisionBlock(page, id).locator("article[data-testid^=ask-]");

/** Whether the element that holds the focus is the host element the aids move it to. */
export const focusOnHost = (page: Page) =>
  page.evaluate((host) => document.activeElement?.matches(host) ?? false, HOST);

/** Puts the focus on the parts, as a click on Read first's text does, where the page's keys act. */
export async function focusParts(page: Page): Promise<void> {
  await readFirst(page).getByText("Read first", { exact: true }).click();
  expect(await focusOnHost(page)).toBe(false);
}

/** A host's decided document with a link, and one request over it (and a spec's verification). */
export async function seedDecided(
  page: Page,
  kind: HostKind
): Promise<Seeded & { decisions: readonly [Decision, Decision, Decision]; targetTitle: string }> {
  const targetTitle = uniqueName("link target");
  const target = await createIssue(
    { force: true, project: (await runProject(await personOf(page))).key, title: targetTitle },
    AGENT
  );
  const decisions = seedDecisions();
  const seeded = await seedHost(page, kind, decidedText(target.key, decisions));
  if (seeded.issueKey !== undefined) {
    await createIssueArtifact(
      seeded.issueKey,
      { content: "# Verification\n\nOne check.\n", name: "verification.md" },
      ARCHITECT
    );
  }
  await requestApproval(
    seeded.artifactId,
    { include_verification: seeded.issueKey !== undefined },
    ARCHITECT
  );
  return { ...seeded, decisions, targetTitle };
}

/** Waits until Read first lists the request and every decision. */
export async function readFirstListed(page: Page): Promise<void> {
  await expect(readFirst(page).getByRole("listitem")).toHaveCount(1 + DECISIONS.length);
}
