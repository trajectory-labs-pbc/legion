import { describe, expect, test } from "bun:test";

import { type EmptyListAddress, emptyList } from "./empty-list";

const VIEWER = "reader@example.com";

/** What the list says for `address`, read by the viewer, with the credential requests settled. */
const say = (address: EmptyListAddress, credentialsHold = false) =>
  emptyList({ address, viewer: VIEWER, agentName: "Builder", credentialsHold });

describe("what an empty Inbox list says", () => {
  test("INB-30 typed text wins over every other reason, and offers Clear filters only beside a filter", () => {
    const text = {
      title: "Nothing matches this text",
      sentence: "No row holds the text in the search box.",
    };
    expect(say({ q: "deploy", show: "dismissed" }, true)).toEqual({
      ...text,
      clearsFilters: false,
    });
    expect(say({ q: "deploy", filters: { project: ["web"] } })).toEqual({
      ...text,
      clearsFilters: true,
    });
    expect(say({ q: "deploy", agent: "s1" })).toEqual({ ...text, clearsFilters: true });
    expect(say({ q: "deploy", assignees: ["other@example.com"] })?.clearsFilters).toBe(true);
    expect(say({ q: "deploy", assignees: [VIEWER] })?.clearsFilters).toBe(false);
  });

  test("INB-30 an address of spaces, or text past the cap, narrows nothing", () => {
    expect(say({ q: "   " })?.title).toBe("Nothing needs you");
    expect(say({ q: `${" ".repeat(1000)}deploy` })?.title).toBe("Nothing needs you");
  });

  test("INB-31 the Dismissed view says so, with no action", () => {
    expect(say({ show: "dismissed", agent: "s1" }, true)).toEqual({
      title: "Nothing dismissed",
      sentence: "Threads that you dismiss show here.",
      clearsFilters: false,
    });
  });

  test("INB-32 an agent's list names the agent in plain text and offers Clear filters", () => {
    expect(say({ agent: "s1", filters: { project: ["web"] } }, true)).toEqual({
      title: "No open asks from Builder",
      sentence: "New asks from this agent show here.",
      clearsFilters: true,
    });
  });

  test("INB-33 a filter of a field or a selection of other people matches nothing", () => {
    const filter = {
      title: "Nothing matches this filter",
      sentence: "No row matches the filters that you chose.",
      clearsFilters: true,
    };
    expect(say({ filters: { priority: ["p1"] } })).toEqual(filter);
    expect(say({ filters: { type: ["reply"] }, assignees: [VIEWER] })).toEqual(filter);
    expect(say({ assignees: ["other@example.com"] })).toEqual(filter);
    expect(say({ assignees: ["unassigned"] })).toEqual(filter);
    expect(say({ assignees: [VIEWER, "other@example.com"] })).toEqual(filter);
  });

  test("INB-33 the reader's own list and everyone's say who has nothing", () => {
    const own = { title: "Nothing needs you", sentence: "New asks and replies for you show here." };
    expect(say({})).toEqual({ ...own, clearsFilters: false });
    expect(say({ assignees: [VIEWER] })).toEqual({ ...own, clearsFilters: false });
    expect(say({ filters: { project: [] } })).toEqual({ ...own, clearsFilters: false });
    expect(say({ assignees: [] })).toEqual({
      title: "Nothing needs anyone",
      sentence: "Open asks for each person show here.",
      clearsFilters: false,
    });
    const signedOut = emptyList({
      address: {},
      viewer: undefined,
      agentName: undefined,
      credentialsHold: false,
    });
    expect(signedOut?.title).toBe("Nothing needs anyone");
  });

  test("INB-34 the credential requests hold the filtered, own and everyone lists", () => {
    expect(say({}, true)).toBeUndefined();
    expect(say({ assignees: [] }, true)).toBeUndefined();
    expect(say({ filters: { project: ["web"] } }, true)).toBeUndefined();
  });
});
