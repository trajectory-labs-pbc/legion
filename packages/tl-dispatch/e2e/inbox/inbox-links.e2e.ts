// Check `inbox-links`: each URL form of the Inbox (the parity file's region 1) opens the view and
// the row that it names. INB-16 is not here: the fork changes the default grouping on purpose.
import { randomUUID } from "node:crypto";

import {
  chooseView,
  closeView,
  expectOpen,
  focusPage,
  inboxHeading,
  main,
  openRow,
  row,
  search,
  watch,
} from "./page";
import { expect, test } from "./seed";

test("INB-1 / opens the Inbox page, with its heading and each kind of row", async ({
  inbox,
  page,
}) => {
  const rows = [
    await inbox.ask("withOptions", "Ship the ledger today?"),
    await inbox.ask("oneChoice", "Where does the canary run?"),
    await inbox.ask("severalChoices", "Which platforms get the build?"),
    await inbox.ask("noOptions", "What should the release note say?"),
    await inbox.approval(),
    await inbox.decisionInDocument("Which service moves first?"),
    await inbox.unreadThread("How far back does a replay go?", ["One hour."]),
  ];
  const credential = await inbox.credentialRequest("LEDGER_API_KEY");
  await page.goto("/");
  await expect(inboxHeading(page)).toBeVisible();
  for (const seeded of rows) await expect(row(main(page), seeded.text)).toBeVisible();
  if (credential !== undefined) {
    await expect(
      page.getByRole("region", { name: "Credential requests" }).getByText(credential.text)
    ).toBeVisible();
  }
});

test("INB-2 /credentials/<anything> opens the Inbox, and /credentials/machine its own page", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Rotate the ledger key?");
  await page.goto("/credentials/request");
  await expect(row(main(page), ask.text)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await page.goto("/credentials/machine");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Inbox");
});

test("INB-3 /replies lands on the Inbox's reply rows, with no history entry of its own", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Hold the mirror?");
  const thread = await inbox.unreadThread("Does the mirror replay on a cold start?", ["Yes."]);
  const settled = watch(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto("/replies");
  await expect(row(main(page), thread.text)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect(search(page).get("type")).toBe("reply");
  await settled();
  await expect(row(main(page), ask.text)).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("INB-4 /answers opens Answered by you, with the reader's answers", async ({ inbox, page }) => {
  const answered = await inbox.answered("Ship the canary first?");
  await page.goto("/answers");
  await expect(page.getByRole("heading", { level: 1, name: "Answered by you" })).toBeVisible();
  await expect(main(page).getByRole("listitem").filter({ hasText: answered.text })).toBeVisible();
});

test("INB-5 ?item= selects the ask it names and shows it in the reading pane", async ({
  inbox,
  page,
}) => {
  const [first, second] = await inbox.asks(2, "Which lease moves");
  if (first === undefined || second === undefined) throw new Error("two asks were seeded");
  await page.goto(await inbox.address({ item: first.id }));
  await expect(openRow(page)).toHaveCount(1);
  await expectOpen(page, first.text);
  await expect(
    page.getByRole("region", { name: "Selected question" }).getByText(first.text).first()
  ).toBeVisible();
  expect(search(page).get("item")).toBe(first.id);
});

test("INB-6 an ?item= the list does not hold selects the first row and writes its id", async ({
  inbox,
  page,
}) => {
  const [older, newer] = await inbox.asks(2, "Which mirror replays");
  if (older === undefined || newer === undefined) throw new Error("two asks were seeded");
  await page.goto(await inbox.address({ item: randomUUID() }));
  await expectOpen(page, newer.text);
  await expect.poll(() => search(page).get("item")).toBe(newer.id);
});

test("INB-7 an ?item= in the folded Later band opens the band and selects the row", async ({
  inbox,
  page,
}) => {
  await inbox.ask("withOptions", "Keep the retry budget?");
  const later = await inbox.ask("withOptions", "Move the clock later?");
  await inbox.snooze(later.id);
  await page.goto(await inbox.address({ item: later.id }));
  await expect(main(page).getByRole("button", { name: /^Later/ })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expectOpen(page, later.text);
});

test("INB-8 ?item= stays unread while the list is empty or its read failed", async ({
  inbox,
  page,
}) => {
  const missing = randomUUID();
  const settled = watch(page);
  // An empty list: this test's project holds no row yet.
  await page.goto(await inbox.address({ item: missing }));
  await expect(inboxHeading(page)).toBeVisible();
  await settled();
  expect(search(page).get("item")).toBe(missing);
  // A failed read, of a project that holds a row.
  await inbox.ask("withOptions", "Replay the whole ledger?");
  await page.route("**/api/v1/inbox", (route) => route.fulfill({ status: 500 }));
  await page.goto(await inbox.address({ item: missing }));
  await expect(page.getByText("Could not load your inbox.")).toBeVisible();
  expect(search(page).get("item")).toBe(missing);
});

test("INB-9 a selection replaces the history entry, so Back leaves the Inbox in one step", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(4, "Which window replays");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto(await inbox.address());
  await expectOpen(page, asks[3]?.text ?? "");
  await focusPage(page);
  for (const next of [asks[2], asks[1], asks[0]]) {
    await page.keyboard.press("j");
    await expectOpen(page, next?.text ?? "");
    await expect.poll(() => search(page).get("item")).toBe(next?.id);
  }
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("INB-10 ?agent= lists that agent's asks alone, with no thread row", async ({
  inbox,
  page,
}) => {
  const [agent, other] = [randomUUID(), randomUUID()];
  const own = await inbox.ask("withOptions", "Ship from this session?", agent);
  const others = await inbox.ask("withOptions", "Ship from the other session?", other);
  const thread = await inbox.unreadThread("Who owns the mirror?", ["The ledger team."]);
  const settled = watch(page);
  await page.goto(await inbox.address({ agent }));
  await expect(row(main(page), own.text)).toBeVisible();
  await settled();
  await expect(row(main(page), others.text)).toHaveCount(0);
  await expect(row(main(page), thread.text)).toHaveCount(0);
  await page.getByRole("link", { name: "Clear agent filter" }).click();
  await expect(row(main(page), others.text)).toBeVisible();
  await expect(row(main(page), thread.text)).toBeVisible();
});

test("INB-11 ?section=needs-you keeps the asks waiting on the reader, not snoozed, and no thread", async ({
  inbox,
  page,
}) => {
  const waiting = await inbox.ask("withOptions", "Approve the lease change?");
  const snoozed = await inbox.ask("withOptions", "Approve the clock change?");
  await inbox.snooze(snoozed.id);
  const thread = await inbox.unreadThread("When does the mirror catch up?", ["By noon."]);
  const settled = watch(page);
  await page.goto(await inbox.address({ section: "needs-you" }));
  await expect(row(main(page), waiting.text)).toBeVisible();
  await settled();
  await expect(row(main(page), snoozed.text)).toHaveCount(0);
  await expect(row(main(page), thread.text)).toHaveCount(0);
});

test("INB-12 ?q= fills the search box and filters by its first 1000 characters", async ({
  inbox,
  page,
}) => {
  const long = await inbox.ask("withOptions", `Keep ${"the ledger window ".repeat(60)}open?`);
  const other = await inbox.ask("withOptions", "Close the mirror window?");
  // Past the first 1000 characters the text matches nothing, and the list ignores it.
  const query = `${long.text.slice(0, 1000)}${"z".repeat(200)}`;
  const settled = watch(page);
  await page.goto(await inbox.address({ q: query }));
  await expect(page.getByRole("searchbox", { name: "Search asks" })).toHaveValue(query);
  await expect(row(main(page), long.text)).toBeVisible();
  await settled();
  await expect(row(main(page), other.text)).toHaveCount(0);
});

test("INB-13 ?assignee= lists the reader's own, a person's, everyone's or nobody's questions", async ({
  inbox,
  page,
}) => {
  const mine = await inbox.ask("withOptions", "Mine to answer?");
  const reader = await inbox.reader();
  const settled = watch(page);
  const listed = async (assignee: string[], shows: boolean) => {
    const query = new URLSearchParams({ project: await inbox.project() });
    for (const value of assignee) query.append("assignee", value);
    await page.goto(`/?${query}`);
    await expect(inboxHeading(page)).toBeVisible();
    await settled();
    await expect(row(main(page), mine.text)).toHaveCount(shows ? 1 : 0);
  };
  await listed([], true);
  await listed([`  ${reader.toUpperCase()} `, reader], true);
  await listed(["everyone"], true);
  await listed(["unassigned"], false);
  await listed([`nobody-${randomUUID()}@example.com`], false);
});

test("INB-14 View › Show › Dismissed writes ?show=dismissed, and Inbox takes it away", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Dismissed view?");
  await page.goto(await inbox.address());
  await expect(row(main(page), ask.text)).toBeVisible();
  await chooseView(page, "Show", "Dismissed");
  await expect.poll(() => search(page).get("show")).toBe("dismissed");
  await expect(row(main(page), ask.text)).toHaveCount(0);
  await chooseView(page, "Show", "Inbox");
  await expect.poll(() => search(page).has("show")).toBe(false);
  await expect(row(main(page), ask.text)).toBeVisible();
});

test("INB-15 ?sort= takes each sort, and Newest first, the default, leaves the address", async ({
  inbox,
  page,
}) => {
  await inbox.ask("withOptions", "Sort the queue?");
  const sorts = {
    assignee: "Assignee",
    priority: "Priority",
    project: "Project",
    type: "Type",
    urgency: "Urgency",
  };
  for (const [value, label] of Object.entries(sorts)) {
    await page.goto(await inbox.address({ sort: value }));
    await page.getByRole("button", { name: "View" }).click();
    await expect(
      page.getByRole("group", { name: "Sort by" }).getByRole("radio", { name: label })
    ).toBeChecked();
    await closeView(page);
  }
  await chooseView(page, "Sort by", "Newest first");
  await expect.poll(() => search(page).has("sort")).toBe(false);
});

test("INB-17 the filter lists read comma lists and repeats, drop unknown words, and write one list", async ({
  inbox,
  page,
}) => {
  await inbox.ask("withOptions", "Filter the queue?");
  const project = await inbox.project();
  await page.goto(`/?project=${project}&priority=P1,bogus&priority=P0&urgency=&type=question`);
  await expect(inboxHeading(page)).toBeVisible();
  // Any change writes the whole address again.
  await chooseView(page, "Sort by", "Urgency");
  await expect.poll(() => search(page).get("sort")).toBe("urgency");
  expect(search(page).get("priority")).toBe("P1,P0");
  expect(search(page).getAll("priority")).toHaveLength(1);
  expect(search(page).has("urgency")).toBe(false);
  expect(search(page).get("type")).toBe("question");
  expect(search(page).get("project")).toBe(project);
});

test("INB-18 a filter, sort, group or show change replaces the history entry", async ({
  inbox,
  page,
}) => {
  await inbox.ask("withOptions", "Group the queue?");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto(await inbox.address());
  await expect(inboxHeading(page)).toBeVisible();
  await chooseView(page, "Sort by", "Urgency");
  await expect.poll(() => search(page).get("sort")).toBe("urgency");
  await chooseView(page, "Group by", "Type");
  await expect.poll(() => search(page).get("group")).toBe("type");
  await chooseView(page, "Show", "Dismissed");
  await expect.poll(() => search(page).get("show")).toBe("dismissed");
  await closeView(page);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("INB-19 a plain / leaves every field at its default out of the address", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Plain address?");
  const fields = () => [...search(page).keys()].filter((key) => key !== "item");
  await page.goto("/");
  await expect(row(main(page), ask.text)).toBeVisible();
  expect(fields()).toEqual([]);
  await chooseView(page, "Sort by", "Urgency");
  await expect.poll(fields).toEqual(["sort"]);
  await chooseView(page, "Sort by", "Newest first");
  await expect.poll(fields).toEqual([]);
});

test("INB-20 an answer's row links to its ask's own page, and its owner to the owner's page", async ({
  inbox,
  page,
}) => {
  const answered = await inbox.answered("Answer and open?");
  await page.goto("/answers");
  const answer = main(page).getByRole("listitem").filter({ hasText: answered.text });
  await expect(answer.getByRole("link", { name: answered.issue })).toHaveAttribute(
    "href",
    `/issues/${answered.issue}`
  );
  await answer.getByRole("link", { exact: true, name: "Open" }).click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith(`/issues/${answered.issue}/`));
  await expect(page).toHaveURL((url) => url.pathname.includes(answered.id));
});
