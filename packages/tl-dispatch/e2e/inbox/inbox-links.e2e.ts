// Check `inbox-links`: each URL form of the Inbox (the parity file's region 1) opens the view and
// the row that it names. INB-16 is not here: the fork changes the default grouping on purpose.
import { randomUUID } from "node:crypto";

import { inboxSearchBox } from "../../../dispatch/e2e/inbox-filter";
import { ROOT } from "../../../dispatch/e2e/threads-order";
import { expectLoadSettled, watchApiRequests } from "../../../dispatch/e2e/traffic";
import {
  chooseView,
  closeView,
  expectOpen,
  focusPage,
  inboxHeading,
  main,
  openView,
  row,
  search,
} from "./page";
import { expect, test } from "./seed";

const CREDENTIAL = "LEDGER_API_KEY";

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
    await inbox.decisionInDocument(),
    await inbox.unreadThread(ROOT, ["One hour."]),
  ];
  const credential = await inbox.credentialRequest(CREDENTIAL);
  await page.goto(await inbox.address());
  await expect(inboxHeading(page)).toBeVisible();
  for (const seeded of rows) await expect(row(main(page), seeded)).toBeVisible();
  if (credential) {
    await expect(
      page.getByRole("region", { name: "Credential requests" }).getByText(CREDENTIAL)
    ).toBeVisible();
  }
});

test("INB-2 /credentials/<anything> opens the Inbox, and /credentials/machine its own page", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Rotate the ledger key?");
  await page.goto("/credentials/request");
  await expect(inboxHeading(page)).toBeVisible();
  await expect(row(main(page), ask)).toBeVisible();
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
  const traffic = watchApiRequests(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto("/replies");
  await expect(row(main(page), thread)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect(search(page).get("type")).toBe("reply");
  await expectLoadSettled(traffic);
  await expect(row(main(page), ask)).toHaveCount(0);
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
  await expectOpen(page, first);
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
  await expectOpen(page, newer);
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
  await expectOpen(page, later);
});

test("INB-8 ?item= stays unread while the list is empty or its read failed", async ({
  inbox,
  page,
}) => {
  const missing = randomUUID();
  const traffic = watchApiRequests(page);
  // An empty list: this test's project holds no row yet.
  await page.goto(await inbox.address({ item: missing }));
  await expect(inboxHeading(page)).toBeVisible();
  await expectLoadSettled(traffic);
  expect(search(page).get("item")).toBe(missing);
  // A failed read, of a project that holds a row.
  await inbox.ask("withOptions", "Replay the whole ledger?");
  await page.route(
    (url) => url.pathname === "/api/v1/inbox",
    (route) => route.fulfill({ status: 500 })
  );
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
  const [first, second, third, fourth] = asks;
  if (first === undefined || second === undefined || third === undefined || fourth === undefined)
    throw new Error("four asks were seeded");
  await expectOpen(page, fourth);
  await focusPage(page);
  for (const next of [third, second, first]) {
    await page.keyboard.press("j");
    await expectOpen(page, next);
    await expect.poll(() => search(page).get("item")).toBe(next.id);
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
  const traffic = watchApiRequests(page);
  await page.goto(await inbox.address({ agent }));
  await expect(row(main(page), own)).toBeVisible();
  await expectLoadSettled(traffic);
  await expect(row(main(page), others)).toHaveCount(0);
  await expect(row(main(page), thread)).toHaveCount(0);
  // The same project without `agent` lists both.
  await page.goto(await inbox.address());
  await expect(row(main(page), others)).toBeVisible();
  await expect(row(main(page), thread)).toBeVisible();
});

test("INB-11 ?section=needs-you keeps the asks waiting on the reader, not snoozed, and no thread", async ({
  inbox,
  page,
}) => {
  const waiting = await inbox.ask("withOptions", "Approve the lease change?");
  const snoozed = await inbox.ask("withOptions", "Approve the clock change?");
  await inbox.snooze(snoozed.id);
  const thread = await inbox.unreadThread("When does the mirror catch up?", ["By noon."]);
  const traffic = watchApiRequests(page);
  await page.goto(await inbox.address({ section: "needs-you" }));
  await expect(row(main(page), waiting)).toBeVisible();
  await expectLoadSettled(traffic);
  // The Later band starts folded, so its row is never drawn: the snoozed ask has no band at all.
  await expect(main(page).getByRole("button", { name: /^Later/ })).toHaveCount(0);
  await expect(row(main(page), snoozed)).toHaveCount(0);
  await expect(row(main(page), thread)).toHaveCount(0);
});

test("INB-12 ?q= fills the search box and filters by its first 1000 characters", async ({
  inbox,
  page,
}) => {
  const long = await inbox.ask("withOptions", `Keep ${"the ledger window ".repeat(60)}open?`);
  const other = await inbox.ask("withOptions", "Close the mirror window?");
  // Past the first 1000 characters the text matches nothing, and the list ignores it.
  const query = `${long.text.slice(0, 1000)}${"z".repeat(200)}`;
  const traffic = watchApiRequests(page);
  await page.goto(await inbox.address({ q: query }));
  await expect(inboxSearchBox(page)).toHaveValue(query);
  await expect(row(main(page), long)).toBeVisible();
  await expectLoadSettled(traffic);
  await expect(row(main(page), other)).toHaveCount(0);
});

test("INB-13 ?assignee= lists the reader's own, a person's, everyone's or nobody's questions", async ({
  inbox,
  page,
}) => {
  const mine = await inbox.ask("withOptions", "Mine to answer?");
  const reader = await inbox.reader();
  const traffic = watchApiRequests(page);
  const listed = async (assignee: string[], shows: boolean) => {
    const query = new URLSearchParams({ project: await inbox.project() });
    for (const value of assignee) query.append("assignee", value);
    await page.goto(`/?${query}`);
    await expect(inboxHeading(page)).toBeVisible();
    await expectLoadSettled(traffic);
    await expect(row(main(page), mine)).toHaveCount(shows ? 1 : 0);
  };
  await listed([], true);
  await listed([`  ${reader.toUpperCase()} `], true);
  await listed(["everyone"], true);
  await listed(["unassigned"], false);
  await listed([`nobody-${randomUUID()}@example.com`], false);
  // A repeated value is one: any change writes the address with it once.
  await listed([reader, reader], true);
  await chooseView(page, "Sort by", "Urgency");
  await expect.poll(() => search(page).get("sort")).toBe("urgency");
  expect(search(page).getAll("assignee")).toEqual([reader]);
});

test("INB-14 View › Show › Dismissed writes ?show=dismissed, and Inbox takes it away", async ({
  inbox,
  page,
}) => {
  const ask = await inbox.ask("withOptions", "Dismissed view?");
  await page.goto(await inbox.address());
  await expect(row(main(page), ask)).toBeVisible();
  await chooseView(page, "Show", "Dismissed");
  await expect.poll(() => search(page).get("show")).toBe("dismissed");
  await expect(row(main(page), ask)).toHaveCount(0);
  await chooseView(page, "Show", "Inbox");
  await expect.poll(() => search(page).has("show")).toBe(false);
  await expect(row(main(page), ask)).toBeVisible();
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
    const menu = await openView(page);
    await expect(
      menu.getByRole("group", { name: "Sort by" }).getByRole("radio", { name: label })
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

test("INB-18 a search, sort, group or show change replaces the history entry", async ({
  inbox,
  page,
}) => {
  await inbox.ask("withOptions", "Group the queue?");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto(await inbox.address());
  await expect(inboxHeading(page)).toBeVisible();
  await inboxSearchBox(page).fill("queue");
  await expect.poll(() => search(page).get("q")).toBe("queue");
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
  await expect(row(main(page), ask)).toBeVisible();
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
