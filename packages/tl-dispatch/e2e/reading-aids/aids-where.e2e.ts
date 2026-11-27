// The aids show once on each host's live document, and nowhere else.
import { DOCUMENT_SCHEMA_CLOSE_CODE } from "../../../contracts/src/dispatch-api-limits";
import {
  createIssueArtifact,
  createNamedVersion,
  createPriority,
  endPriority,
  patchIssue,
  requestApproval,
} from "../../../dispatch/e2e/api";
import { documentEditor } from "../../../dispatch/e2e/editor";
import { inboxPane } from "../../../dispatch/e2e/inbox-pane";
import { gotoIssue } from "../../../dispatch/e2e/issue-page";
import {
  expectIssuePageDrawn,
  expectOpeningLanded,
  nodeRow,
} from "../../../dispatch/e2e/issue-page-g";
import { caretInNode } from "../../../dispatch/e2e/issue-page-i";
import { withIssuePage } from "../../../dispatch/e2e/issue-page-option";
import { blockNodeId } from "../../../dispatch/web/src/features/issue-page/tree-drafts";
import { signedInLogin } from "../read-as-person";
import { expect, type Page, test } from "../test";
import {
  AGENT,
  FIRST,
  openHost,
  PARTS,
  partsRoot,
  SECOND,
  seedHost,
  shownParts,
  TEXT,
  uniqueName,
} from "./hosts";

/** The Inbox with every assignee's questions, so a document's own question is listed. */
const INBOX = "/?assignee=everyone";

/** The document's text read that admits its editor. */
const TEXT_READ = /\/api\/v1\/artifacts\/[^/]+\/text(?:\?.*)?$/u;

test("aids-where: the parts show once on each host: a spec, a verification, a closed issue's spec and a project document", async ({
  page,
}) => {
  const spec = await seedHost(page, "spec");
  const issueKey = spec.issueKey ?? "";
  const verification = await createIssueArtifact(
    issueKey,
    { content: TEXT, name: "verification.md" },
    AGENT
  );
  const closed = await seedHost(page, "spec");
  await patchIssue(closed.issueKey ?? "", { status: "done" }, AGENT);
  const document = await seedHost(page, "document");
  for (const path of [
    spec.path,
    `/issues/${issueKey}/artifacts/${verification.artifact.slug}`,
    closed.path,
    document.path,
  ]) {
    await test.step(path, async () => {
      if (path === closed.path) {
        await page.goto(path);
        await expect(documentEditor(page)).toContainText(SECOND);
      } else {
        await openHost(page, path);
      }
      await expect(partsRoot(page)).toHaveCount(1);
      await expect.poll(() => shownParts(page)).toBe(1);
    });
  }
});

test("aids-where: the parts show once again on the editor upstream makes after a refused connection", async ({
  page,
}) => {
  const { path } = await seedHost(page, "spec");
  // The first connection is refused as outside the schema once the editor shows; upstream
  // then reads the document again and makes a new editor on the next connection.
  const first = Promise.withResolvers<{ close: () => Promise<void> }>();
  let refused = false;
  await page.routeWebSocket(/\/ws\/doc\//u, (route) => {
    route.connectToServer();
    if (!refused) {
      refused = true;
      first.resolve({
        close: () =>
          route.close({ code: DOCUMENT_SCHEMA_CLOSE_CODE, reason: "outside the schema" }),
      });
    }
  });
  await openHost(page, path);
  await expect(partsRoot(page)).toHaveCount(1);
  await documentEditor(page).evaluate((editor) => editor.setAttribute("data-e2e-first", ""));

  await (await first.promise).close();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(documentEditor(page)).not.toHaveAttribute("data-e2e-first", "");
  await expect(partsRoot(page)).toHaveCount(1);
  await expect.poll(() => shownParts(page)).toBe(1);
});

test("aids-where: nothing shows while the document loads, nor after its load fails", async ({
  page,
}) => {
  const loading = await seedHost(page, "spec");
  const held = Promise.withResolvers<{ release: () => Promise<void> }>();
  let holding = true;
  await page.route(TEXT_READ, (route) => {
    if (!holding) return route.continue();
    holding = false;
    held.resolve({ release: () => route.continue() });
  });
  await page.goto(loading.path);
  const read = await held.promise;
  expect(await shownParts(page)).toBe(0);
  await expect(page.locator(PARTS)).toHaveCount(0);
  await read.release();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(partsRoot(page)).toHaveCount(1);

  const failing = await seedHost(page, "spec");
  await page.unrouteAll();
  await page.route(TEXT_READ, (route) => route.abort());
  await page.goto(failing.path);
  await expect(page.getByText("This document could not load")).toBeVisible();
  await expect(page.locator(PARTS)).toHaveCount(0);
});

test("aids-where: no parts show on a past version, the change view or a hover preview", async ({
  page,
}) => {
  const target = await seedHost(page, "spec");
  const { artifactId, path } = await seedHost(
    page,
    "spec",
    `${TEXT}\nSee dispatch://${target.issueKey ?? ""} for the target.\n`
  );
  await createNamedVersion(artifactId, "The first version.", AGENT);

  await openHost(page, path);
  await page.getByRole("combobox", { name: "Version" }).selectOption("1");
  await expect(page.getByTestId("version-view")).toContainText(FIRST);
  await expect.poll(() => shownParts(page)).toBe(0);
  await page.getByRole("button", { name: "Diff vs current" }).click();
  await expect(page.getByRole("button", { name: "Show version" })).toBeVisible();
  await expect.poll(() => shownParts(page)).toBe(0);

  await openHost(page, path);
  await documentEditor(page).locator("a.dispatch-reference").first().hover();
  const card = page.getByRole("tooltip");
  await expect(card).toContainText(target.issueKey ?? "");
  await expect(card.locator(PARTS)).toHaveCount(0);
  await expect.poll(() => shownParts(page)).toBe(1);
});

/** Opens the Inbox on the row that reads `text`, once the server lists it, and selects it. */
async function selectInboxRow(page: Page, text: string): Promise<void> {
  const row = page.locator("[data-inbox-row]").filter({ hasText: text });
  await expect(async () => {
    await page.goto(INBOX);
    await expect(row).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await row.locator("time").first().click();
  await expect(row).toHaveAttribute("data-inbox-selected", "true");
}

test("aids-where: no parts show in the Inbox's pane, on a document or on an approval request", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  const question = uniqueName("decision");
  await seedHost(
    page,
    "spec",
    `${TEXT}\n:::ask{#aids-decision urgency="med" multiple="false" state="open"}\n${question}\n\n- Yes\n- No\n:::\n`
  );
  const document = await seedHost(page, "document");
  const summary = uniqueName("approval");
  await requestApproval(document.artifactId, { summary }, AGENT);

  await selectInboxRow(page, question);
  await expect(inboxPane(page).locator('[data-dispatch-ask-block="aids-decision"]')).toContainText(
    question
  );
  await expect(page.locator(PARTS)).toHaveCount(0);

  await selectInboxRow(page, summary);
  await expect(inboxPane(page).getByRole("region", { name: /^Document version/u })).toContainText(
    FIRST
  );
  await expect(page.locator(PARTS)).toHaveCount(0);
});

test("aids-where: no parts show in an outline row's editor", async ({ context, page }) => {
  // The outline lists a typed block as a row; a paragraph is not one.
  const requirement = "A requirement the outline lists.";
  const { issueKey } = await seedHost(
    page,
    "spec",
    `${TEXT}\n## Requirements\n\n:::requirement{#r-aids}\n${requirement}\n:::\n`
  );
  await withIssuePage(context, await signedInLogin(page));
  // As upstream enters a node: End reaches the outline's last row, the requirement.
  await gotoIssue(page, `/issues/${issueKey ?? ""}`);
  await expectIssuePageDrawn(page);
  await expectOpeningLanded(page);
  await page.keyboard.press("End");
  await expect(nodeRow(page, blockNodeId("spec", "r-aids")).first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => caretInNode(page)).toBe(true);
  await expect(page.locator("[data-editor-box] [contenteditable='true']")).toBeVisible();
  await expect(page.locator(PARTS)).toHaveCount(0);
});

test("aids-where: no parts show in a priority's description", async ({ page }) => {
  const priority = await createPriority(
    { description: TEXT, owner: await signedInLogin(page), title: uniqueName("priority") },
    AGENT
  );
  try {
    await page.goto(`/priorities/${priority.id}`);
    await expect(page.getByRole("textbox", { exact: true, name: "Description" })).toContainText(
      FIRST
    );
    await expect(page.locator(PARTS)).toHaveCount(0);
  } finally {
    await endPriority(priority.id, AGENT);
  }
});
