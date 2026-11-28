// A document an agent changed in one section, compared with its first version, for Only changes.
import { editArtifact } from "../../../dispatch/e2e/api";
import { documentEditor } from "../../../dispatch/e2e/editor";
import { AGENT } from "../flows";
import { expect, type Page } from "../test";
import { pickVersion } from "./baseline-seed";
import { type HostKind, openHost, partsRoot, SECOND, type Seeded, seedHost } from "./hosts";

export const CHANGED = "The changed section's paragraph, which the agent rewords today.";
const REWORDED = "The changed section's paragraph, which the agent rewords now.";

/** The class of each block Only changes folds. */
export const ONLY_CHANGES_FOLD = "reading-aids-only-changes";

/** Each block Only changes folds now, in document order. */
export const onlyFolded = (page: Page) => documentEditor(page).locator(`.${ONLY_CHANGES_FOLD}`);

/** The counts line's Only changes control. */
export const onlyChangesControl = (page: Page) =>
  partsRoot(page).getByRole("button", { name: "Only changes" });

/** Turns Only changes on with `u` from the page: no aid key acts while the focus is in the text or a field, so the focus is let go first. */
export async function onlyChangesOn(page: Page): Promise<void> {
  await expect(onlyChangesControl(page)).toBeVisible();
  const focused = page.locator(":focus");
  if ((await focused.count()) > 0) await focused.blur();
  await expect(focused).toHaveCount(0);
  await page.keyboard.press("u");
  await expect(onlyChangesControl(page)).toHaveAttribute("aria-pressed", "true");
}

/** `before`, a changed section, then `quiet`; the agent rewords "today" to "now" in each of `reworded` too. */
export async function seedChanged(
  page: Page,
  kind: HostKind,
  quiet: readonly string[],
  { before = [], reworded = [] }: { before?: readonly string[]; reworded?: readonly string[] } = {}
): Promise<Seeded> {
  const text = [...before, "## Changed", CHANGED, ...quiet, ""].join("\n\n");
  const seeded = await seedHost(page, kind, text);
  const edits = [CHANGED, ...reworded].map((find) => ({
    find,
    op: "replace" as const,
    with: find.replace("today", "now"),
  }));
  await editArtifact(seeded.artifactId, { ops: edits }, AGENT);
  return seeded;
}

/** A paragraph of a run in the lines document, which no version changes. */
export const RUN_PARAGRAPH = (n: number) => `The run's paragraph ${n}, which no version changes.`;
const RUN_FIRST = "The run's first changed paragraph, which the agent rewords today.";
const RUN_LAST = "The run's last changed paragraph, which the agent rewords today.";
const ITEM = "The list's second item, which the agent rewords today.";

/** The fold lines of the lines document, in its order: the preamble's, the run's and the list's. */
export const LINES = [
  { name: "preamble", text: "3 unchanged blocks" },
  { name: "run", text: "2 unchanged blocks" },
  { name: "list", text: "3 unchanged items" },
] as const;

export const LINE_TEXTS = LINES.map(({ text }) => text);

/** A quiet preamble of three blocks, a run of four between two changes, and a list changed at item 2 of 6. */
export const seedLines = (page: Page, kind: HostKind) =>
  seedChanged(
    page,
    kind,
    [
      "## Runs",
      RUN_FIRST,
      ...[1, 2, 3, 4].map(RUN_PARAGRAPH),
      RUN_LAST,
      "## List",
      [
        "- The list's first item.",
        `- ${ITEM}`,
        ...[3, 4, 5, 6].map((n) => `- The list's item ${n}, which no version changes.`),
      ].join("\n"),
    ],
    {
      before: [
        "The preamble's first paragraph, which no version changes.",
        SECOND,
        "The preamble's last paragraph, which no version changes.",
      ],
      reworded: [RUN_FIRST, RUN_LAST, ITEM],
    }
  );

/** Each fold line's button in the page's document, in its order. */
export const foldLines = (page: Page) =>
  documentEditor(page).locator("[data-reading-aids-fold-line] button");

/** Opens `path` and compares it with its first version, once the marks have drawn. */
export async function openComparedWithFirst(page: Page, path: string) {
  await openHost(page, path);
  await expect(documentEditor(page)).toContainText(REWORDED);
  await pickVersion(page, 1);
  await expect(partsRoot(page)).toContainText("Since v1");
  await expect(onlyChangesControl(page)).toBeVisible();
}
