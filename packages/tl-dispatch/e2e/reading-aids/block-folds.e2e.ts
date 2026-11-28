// Each requirement, check and plan task folds to its head line, and the reader's moves open it.
import {
  createComment,
  createIssue,
  createIssueArtifact,
  editArtifact,
} from "../../../dispatch/e2e/api";
import { documentEditor, marginCard, placeCaret, typeAtEnd } from "../../../dispatch/e2e/editor";
import { navigateInApp } from "../../../dispatch/e2e/sends";
import { AGENT, personOf, runProject } from "../flows";
import { expect, type Page, test } from "../test";
import { REVISE_REQUIREMENT, seedEditedSpec, TYPED_READ } from "./baseline-seed";
import { blockIdOf, bottom, head, openHost, top, uniqueName } from "./hosts";

const SECOND_PARAGRAPH = "Its second paragraph, which a reference names.";
const THIRD_PARAGRAPH =
  "Its third paragraph runs long enough to wrap over several lines of the text column, so " +
  "that the comment it holds sits on a line below the first one: it goes on with more words, " +
  "and more words again, until the thread's quote at its end, which a comment names here.";
const QUOTE = "which a comment names here";
const SECOND_STEP = "The second step, which a reference names.";

/** The spec; its check serves `served`, a requirement its header links to. */
const spec = (served: string) =>
  [
    "# Folds",
    "",
    "An intro paragraph.",
    "",
    ":::requirement{#r1}",
    "**R1.** The first requirement.",
    "",
    SECOND_PARAGRAPH,
    "",
    THIRD_PARAGRAPH,
    ":::",
    "",
    `:::check{#c1 serves="${served}"}`,
    "The check of the first requirement, which holds a needle.",
    ":::",
    "",
    ":::plan_task{#t1}",
    "**T1.** The first task.",
    "",
    "The first step, which holds a haystack.",
    "",
    SECOND_STEP,
    ":::",
    "",
    "A closing paragraph.",
    "",
  ].join("\n");

interface Seeded {
  key: string;
  path: string;
  paragraph: string;
  step: string;
  thread: string;
  /** The comment on the requirement's second paragraph: the first card of the requirement's. */
  paragraphComment: string;
}

/** The spec, with a comment on the requirement's second paragraph and on the task's second
 *  step, which upstream counts beside each, and a thread on the third paragraph's last line:
 *  two cards in the requirement's fold, the thread's stacked below the first. */
async function seedSpec(page: Page): Promise<Seeded> {
  const project = (await runProject(await personOf(page))).key;
  const served = await createIssue(
    {
      force: true,
      project,
      spec: ":::requirement{#r1}\nThe served requirement.\n:::\n",
      title: uniqueName("served"),
    },
    AGENT
  );
  // A check serves only a block of its own issue or of one above it.
  const issue = await createIssue(
    {
      force: true,
      parent: served.key,
      project,
      spec: spec(`dispatch://${served.key}/spec#b-r1`),
      title: uniqueName("folds"),
    },
    AGENT
  );
  const specId = issue.primary_artifact_id ?? "";
  const paragraph = await blockIdOf(specId, SECOND_PARAGRAPH);
  const step = await blockIdOf(specId, SECOND_STEP);
  // A comment anchored in a block is what upstream counts beside it.
  const [paragraphComment] = await Promise.all(
    ["Its second paragraph", "The second step"].map((quote) =>
      createComment(
        issue.key,
        { anchor: { artifact: "spec", quote }, body: "A reference to this block." },
        AGENT
      )
    )
  );
  const thread = await createComment(
    issue.key,
    { anchor: { artifact: "spec", quote: QUOTE }, body: "A thread in the fold." },
    AGENT
  );
  return {
    key: issue.key,
    path: `/issues/${issue.key}/spec`,
    paragraph,
    step,
    thread: thread.id,
    paragraphComment: paragraphComment?.id ?? "",
  };
}

const block = (page: Page, blockId: string) =>
  documentEditor(page).locator(`[data-block-id="${blockId}"]`).first();

test("block-folds: the head is a button whose own Enter and Space open and fold its block", async ({
  page,
}) => {
  const { path } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  for (const id of ["r1", "c1", "t1"]) {
    await expect(head(page, id)).toHaveAttribute("aria-expanded", "false");
  }
  const button = head(page, "r1");
  await expect.poll(async () => (await block(page, "r1").boundingBox())?.height).toBe(0);

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(button).toBeFocused();
  await expect.poll(async () => (await block(page, "r1").boundingBox())?.height).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(documentEditor(page)).toContainText("The first requirement.");
});

test("block-folds: the head-line case: a folded block's first card and counters sit at its fold line, and its second card stacks below the first", async ({
  page,
}) => {
  const { paragraph, paragraphComment, path, step, thread } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  const firstCard = marginCard(page, paragraphComment);
  const secondCard = marginCard(page, thread);
  const paragraphCounter = page.locator(`[data-block-references="${paragraph}"]`);
  const stepCounter = page.locator(`[data-block-references="${step}"]`);
  for (const shown of [firstCard, secondCard, paragraphCounter, stepCounter]) {
    await expect(shown).toBeVisible();
  }
  await expect(head(page, "r1")).toHaveAttribute("aria-expanded", "false");

  const measure = async () => ({
    firstCard: await top(firstCard),
    firstCardBottom: await bottom(firstCard),
    foldLine: await top(block(page, "r1")),
    headBottom: await bottom(page.locator('[data-reading-aids-fold-head="r1"]')),
    paragraphCounter: await top(paragraphCounter),
    secondCard: await top(secondCard),
    stepCounter: await top(stepCounter),
    stepFoldLine: await top(block(page, "t1")),
  });
  // Upstream places the cards and counters a frame after a layout change.
  await expect(async () => {
    const at = await measure();
    // Within 1 px: a mark span's line box below the fold line moves its card (the font rules).
    expect(Math.abs(at.firstCard - at.foldLine)).toBeLessThanOrEqual(1);
    // Upstream stacks a card CARD_GAP (8 px) below the one above it, by its rounded offsetHeight.
    expect(at.secondCard - at.firstCardBottom).toBeGreaterThanOrEqual(-1);
    expect(at.secondCard - at.firstCardBottom).toBeLessThanOrEqual(8 + 1);
    expect(Math.abs(at.paragraphCounter - at.foldLine)).toBeLessThanOrEqual(4);
    expect(Math.abs(at.stepCounter - at.stepFoldLine)).toBeLessThanOrEqual(4);
    expect(at.foldLine - at.headBottom).toBeGreaterThanOrEqual(0);
    expect(at.foldLine - at.headBottom).toBeLessThanOrEqual(4);
  }).toPass();
});

const expanded = (page: Page, blockId: string) => head(page, blockId).getAttribute("aria-expanded");

/** Each head's state, by block id. */
async function folds(page: Page): Promise<Record<string, string | null>> {
  const ids = ["r1", "c1", "t1"];
  const states = await Promise.all(ids.map((id) => expanded(page, id)));
  return Object.fromEntries(ids.map((id, index) => [id, states[index] ?? null]));
}

test("block-folds: a folded block a change touched draws no label, so none stands in the next block's gutter", async ({
  page,
}) => {
  const { path } = await seedEditedSpec(page, TYPED_READ, REVISE_REQUIREMENT);
  await openHost(page, path);
  await expect(head(page, "r1")).toHaveAttribute("aria-expanded", "true");
  await head(page, "r1").click();
  const requirement = documentEditor(page).locator(
    '[data-reading-aids-change][data-block-id="r1"]'
  );
  await expect(requirement).toHaveClass(/reading-aids-folded/);
  const label = await requirement.evaluate((block) => {
    const style = getComputedStyle(block, "::before");
    return { content: style.content, fontSize: style.fontSize, height: style.height };
  });
  expect(label.content).not.toBe("none");
  expect(label).toMatchObject({ fontSize: "0px", height: "0px" });
});

test("block-folds: the changed case: the block a change touched since the baseline shows open, and a later change neither folds nor opens a block", async ({
  page,
}) => {
  const { artifactId, path } = await seedEditedSpec(page, TYPED_READ, REVISE_REQUIREMENT);
  await openHost(page, path);
  await expect.poll(() => folds(page)).toEqual({ c1: "false", r1: "true", t1: "false" });

  await editArtifact(
    artifactId,
    { ops: [{ find: "The check as read.", op: "replace", with: "The check as revised later." }] },
    AGENT
  );
  await expect(
    documentEditor(page).locator('[data-reading-aids-change][data-block-id="c1"]')
  ).toHaveCount(1);
  expect(await folds(page)).toEqual({ c1: "false", r1: "true", t1: "false" });
});

test("block-folds: a #b- link, the page's ?q= at the open and after its change open the folds they land in, and the return keeps them", async ({
  page,
}) => {
  const { key, paragraph, path } = await seedSpec(page);
  const other = await createIssueArtifact(
    key,
    { content: "Another document of the issue.\n", name: "notes.md" },
    AGENT
  );
  await openHost(page, `${path}?q=needle#b-${paragraph}`, "An intro paragraph.");
  await expect.poll(() => folds(page)).toEqual({ c1: "true", r1: "true", t1: "false" });

  await navigateInApp(page, `${path}?q=haystack`);
  await expect.poll(() => folds(page)).toEqual({ c1: "true", r1: "true", t1: "true" });
  await head(page, "c1").click();
  await expect.poll(() => folds(page)).toEqual({ c1: "false", r1: "true", t1: "true" });

  await navigateInApp(page, `/issues/${key}/artifacts/${other.artifact.slug}`);
  await expect(documentEditor(page)).toContainText("Another document of the issue.");
  // Each frame of the return, until the test reads it: is a block the reader opened folded?
  await page.evaluate(() => {
    const frames: boolean[] = [];
    Object.assign(window, { foldFrames: frames });
    const sample = () => {
      if (document.querySelector('[data-block-id="r1"]') !== null) {
        frames.push(document.querySelector('[data-block-id="r1"].reading-aids-folded') !== null);
      }
      if (frames.length < 120) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await navigateInApp(page, path);
  await expect(documentEditor(page)).toContainText("An intro paragraph.");
  await expect.poll(() => folds(page)).toEqual({ c1: "false", r1: "true", t1: "true" });
  const frames = await page.evaluate(
    () => (window as unknown as { foldFrames: boolean[] }).foldFrames
  );
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter(Boolean)).toEqual([]);
});

test("block-folds: the caret opens the fold it enters with the arrow keys, the fold stays open when it leaves, and the margin's thread opens its fold", async ({
  page,
}) => {
  const { path, thread } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  // The folds come after the text; a caret already in r1 when they do leaves it folded.
  await expect(head(page, "r1")).toHaveAttribute("aria-expanded", "false");
  // ProseMirror writes its selection 20 ms after a focus; this timer ends after its own.
  await documentEditor(page).focus();
  await expect(documentEditor(page)).toBeFocused();
  await page.evaluate(() => new Promise((done) => setTimeout(done, 20)));
  await placeCaret(page, "after", "An intro paragraph.");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => expanded(page, "r1")).toBe("true");
  await expect.poll(() => folds(page)).toEqual({ c1: "false", r1: "true", t1: "false" });

  await placeCaret(page, "after", "A closing paragraph.");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => expanded(page, "r1")).toBe("true");

  await head(page, "r1").click();
  await expect.poll(() => expanded(page, "r1")).toBe("false");
  await marginCard(page, thread).click();
  await expect.poll(() => expanded(page, "r1")).toBe("true");
});

test("block-folds: the remote-change case: an edit from a second tab, above a block and inside a folded one, leaves each fold as it was", async ({
  context,
  page,
}) => {
  const { path } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  await head(page, "r1").click();
  await expect.poll(() => folds(page)).toEqual({ c1: "false", r1: "true", t1: "false" });

  await head(page, "c1").focus();

  const second = await context.newPage();
  await openHost(second, path, "An intro paragraph.");
  await placeCaret(second, "after", "An intro paragraph.");
  await second.keyboard.type(" Typed above.");
  await head(second, "c1").click();
  await placeCaret(second, "after", "which holds a needle.");
  await second.keyboard.type(" Typed inside.");
  await typeAtEnd(second, "Typed at the end.");

  await expect(documentEditor(page)).toContainText("Typed inside.");
  await expect(documentEditor(page)).toContainText("Typed at the end.");
  expect(await folds(page)).toEqual({ c1: "false", r1: "true", t1: "false" });
  await expect(head(page, "c1")).toContainText("Typed inside.");
  await expect(head(page, "c1")).toBeFocused();
  await expect.poll(async () => (await block(page, "c1").boundingBox())?.height).toBe(0);
});

test("block-folds: a folded block is hidden from the accessibility tree, and a Tab from its head into a hidden link opens it", async ({
  page,
}) => {
  const { path } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  await expect(block(page, "c1")).toHaveAttribute("aria-hidden", "true");
  await head(page, "c1").focus();
  // Each Tab stop, read once its focusin has reached the editor's handler. Upstream's hover card
  // then writes on the link and its block view redraws the block, which drops the focus to the
  // body on upstream's own build too, so the case reads the stop, not the focus after it.
  await page.evaluate(() => {
    const stops: string[] = [];
    Object.assign(window, { foldStops: stops });
    document.addEventListener("focusin", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const id = target?.closest("[data-block-id]")?.getAttribute("data-block-id") ?? "-";
      const hidden = target?.closest('[aria-hidden="true"]') == null ? "" : " hidden";
      stops.push(`${target?.tagName.toLowerCase() ?? "?"}@${id}${hidden}`);
    });
  });
  await page.keyboard.press("Tab");
  // The next stop is a link of the check's own header, which draws what it serves.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { foldStops: string[] }).foldStops))
    .toEqual(["a@c1"]);
  await expect(head(page, "c1")).toHaveAttribute("aria-expanded", "true");
  await expect(block(page, "c1")).not.toHaveAttribute("aria-hidden", "true");
  await expect(block(page, "c1").locator("a[href]").first()).toBeVisible();
});

test("block-folds: each head is a pointer target of at least 24 px, no two overlap, and a Tab stop on one shows the focus outline", async ({
  page,
}) => {
  const { path } = await seedSpec(page);
  await openHost(page, path, "An intro paragraph.");
  const control = page.getByRole("button", { name: "Fold or open blocks" });
  const targets = [control, head(page, "r1"), head(page, "c1"), head(page, "t1")];
  const boxes = await Promise.all(
    targets.map(async (target) => {
      const box = await target.boundingBox();
      if (box === null) throw new Error("a target has no box");
      return box;
    })
  );
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  }
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart).toBe(true);
    }
  }

  await control.focus();
  await expect(async () => {
    await page.keyboard.press("Tab");
    await expect(head(page, "r1")).toBeFocused({ timeout: 100 });
  }).toPass({ timeout: 5_000 });
  const outline = await head(page, "r1").evaluate((button) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--focus)";
    document.body.append(probe);
    const focus = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(button);
    return {
      color: style.outlineColor,
      focus,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(outline.style).toBe("solid");
  expect(outline.width).not.toBe("0px");
  expect(outline.color).toBe(outline.focus);
});
