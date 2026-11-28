import { describe, expect, test } from "bun:test";

import { inboxAddress } from "./routes";

describe("the Inbox's address", () => {
  test("with no ?group= is the Needs you grouping, and ?group=priority is upstream's Priority", () => {
    expect(inboxAddress("").group).toBe("needs-you");
    expect(inboxAddress("?group=priority").group).toBe("priority");
    expect(inboxAddress("?group=urgency").group).toBe("urgency");
    expect(inboxAddress("?group=not-a-grouping").group).toBe("needs-you");
  });

  test("keeps upstream's reading of every other key", () => {
    expect(inboxAddress("?q=release&sort=urgency&section=needs-you")).toMatchObject({
      q: "release",
      sort: "urgency",
      section: "needs-you",
    });
  });
});
