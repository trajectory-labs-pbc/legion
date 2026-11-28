import { describe, expect, test } from "bun:test";

import type { InboxRow } from "@/upstream/contract";
import { INBOX_ASKS, UNREAD_THREAD } from "../../../tests/inbox";
import { reader } from "../../../tests/writes";
import { groupShowsUrgency, type InboxListAddress, inboxList, NEEDS_YOU_GROUP_KEY } from "./list";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const ask = (id: string, overrides: Partial<InboxRow>): InboxRow => ({
  ...INBOX_ASKS.withOptions,
  id,
  ...overrides,
});
const ASKS = [
  ask("mine", { urgency: "high" }),
  ask("agents", { waiting_on: "agent", urgency: "blocking" }),
  ask("snoozed", { snoozed_until: "2026-11-26T09:00:00Z", urgency: "high" }),
];
const list = (address: Partial<InboxListAddress>) =>
  inboxList({
    asks: ASKS,
    threads: [UNREAD_THREAD],
    address: { group: "needs-you", ...address },
    viewer: reader.login,
    now: NOW,
  });
const ids = (rows: readonly { kind: string }[]) =>
  rows.map((row) => ("ask" in row ? (row.ask as InboxRow).id : "thread"));
const shape = (address: Partial<InboxListAddress>) =>
  list(address).groups.map((group) => [group.key, ids(group.rows)]);

describe("the Inbox's list", () => {
  test("puts the threads and the person's asks in Needs you, then each other ask by urgency, then Later", () => {
    const [first, ...rest] = shape({});
    expect(first?.[0]).toBe(NEEDS_YOU_GROUP_KEY);
    expect([...(first?.[1] ?? [])].sort()).toEqual(["mine", "thread"]);
    expect(rest).toEqual([
      ["blocking", ["agents"]],
      ["later", ["snoozed"]],
    ]);
    expect(list({}).own).toBe(true);
  });

  test("names the first group for whose list it is", () => {
    expect(list({}).groups[0]?.label).toBe("Waiting on you");
    const other = list({ assignees: ["someone"] });
    expect(other.own).toBe(false);
    expect(other.groups[0]?.label).toBe("Waiting on a person");
  });

  test("keeps upstream's groupings: Priority bands every row by its priority", () => {
    const keys = list({ group: "priority" }).groups.map((group) => group.key);
    expect(keys).not.toContain(NEEDS_YOU_GROUP_KEY);
    expect(keys.at(-1)).toBe("later");
  });

  test("narrows to the asks of the first band with ?section=needs-you, and to an agent's asks", () => {
    expect(shape({ section: "needs-you" })).toEqual([[NEEDS_YOU_GROUP_KEY, ["mine"]]]);
    expect(shape({ agent: "someone-else" })).toEqual([]);
  });

  test("an urgency group shows the urgency, and Needs you and Later do not", () => {
    expect(groupShowsUrgency("needs-you", "blocking")).toBe(true);
    expect(groupShowsUrgency("needs-you", NEEDS_YOU_GROUP_KEY)).toBe(false);
    expect(groupShowsUrgency("needs-you", "later")).toBe(false);
    expect(groupShowsUrgency("urgency", "high")).toBe(true);
    expect(groupShowsUrgency("urgency", "later")).toBe(false);
    expect(groupShowsUrgency("priority", "P0")).toBe(false);
  });

  test("narrows by the search text", () => {
    expect(shape({ q: "no row holds this" })).toEqual([]);
  });
});
