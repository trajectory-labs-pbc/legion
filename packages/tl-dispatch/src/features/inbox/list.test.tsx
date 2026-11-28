import { afterEach, describe, expect, test } from "bun:test";
import { screen, within } from "@testing-library/react";

import type { InboxRow, MyReplyRow } from "@/upstream/contract";
import { renderApp } from "../../../tests/app";
import { INBOX_ASKS, INBOX_READS, inboxReads, UNREAD_THREAD } from "../../../tests/inbox";
import { answerReads } from "../../../tests/network";
import { signedInClient } from "../../../tests/writes";
import { InboxView } from "./view";

const ask = (id: string, question: string, overrides: Partial<InboxRow> = {}): InboxRow => ({
  ...INBOX_ASKS.withOptions,
  id,
  question,
  ...overrides,
});
const ASKS = [
  ask("mine", "Which release path?", { urgency: "high" }),
  ask("agents", "Is the retry fixed?", { waiting_on: "agent", urgency: "blocking" }),
  ask("theirs", "Who reviews the docs?", {
    issue: { assignee: "someone", key: "CORE-2", title: "Docs" },
  }),
];

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

async function draw(
  path: string,
  asks: InboxRow[] = ASKS,
  threads: MyReplyRow[] = [UNREAD_THREAD]
) {
  answerReads(INBOX_READS, inboxReads({ inbox: () => asks, replies: () => threads }));
  mounted.push(renderApp(<InboxView />, { path, client: signedInClient() }));
  await screen.findByRole("heading", { name: "Inbox" });
}
/** The header of the group a row's line sits in. */
const headerOf = (line: string) =>
  screen
    .getByText(line)
    .closest('[data-slot="collapsible"]')
    ?.querySelector<HTMLElement>('[data-slot="group-header"]') ?? null;
const headers = () => document.querySelectorAll('[data-slot="group-header"]');
const bars = (line: string) =>
  within(
    screen.getByText(line).closest<HTMLElement>('[data-slot="list-row"]') ?? document.body
  ).queryByRole("img", { name: /^Urgency/ });

describe("the new Inbox's list", () => {
  test("with no ?group=, the reader's own list starts with the Needs you mark, then the urgencies", async () => {
    await draw("/");
    await screen.findByText("Which release path?");
    const first = headers()[0];
    expect(first?.querySelector('[aria-label="Needs you: 2"]')).not.toBeNull();
    // The thread is in Needs you; the ask whose turn is an agent's is under its urgency.
    expect(headerOf("Agent: Done.")).toBe(first ?? null);
    expect(headerOf("Is the retry fixed?")?.textContent).toContain("Blocking");
    // A row in an urgency group shows no urgency bars; one in Needs you does.
    expect(bars("Is the retry fixed?")).toBeNull();
    expect(bars("Which release path?")).not.toBeNull();
  });

  test("another person's list titles its first group Waiting on a person", async () => {
    await draw("/?assignee=someone");
    await screen.findByText("Who reviews the docs?");
    expect(headers()[0]?.textContent).toContain("Waiting on a person");
    expect(screen.queryByLabelText(/^Needs you/)).toBeNull();
  });

  test("?group=priority shows upstream's Priority bands, with no Needs you", async () => {
    await draw("/?group=priority");
    await screen.findByText("Which release path?");
    expect(screen.queryByLabelText(/^Needs you/)).toBeNull();
    expect(headerOf("Which release path?")?.textContent).toContain("No priority");
  });

  test("an empty list says that nothing needs the reader", async () => {
    await draw("/", [], []);
    expect(await screen.findByText("Nothing needs you")).toBeDefined();
  });
});
