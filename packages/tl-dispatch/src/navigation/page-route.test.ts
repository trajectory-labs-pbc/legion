import { describe, expect, test } from "bun:test";
import { buildInboxPath } from "@upstream-dispatch/features/refs/routes";

import { inbox } from "@/pages/inbox";
import { issue } from "@/pages/issue";
import { pageHref, pageRoute } from "./page-route";

const machine = pageRoute({ path: "/machines/:machine", element: null, search: ["tab", "q"] });

describe("pageHref", () => {
  test("fills each param, encoded, and the search keys in the route's order", () => {
    expect(pageHref(machine, { machine: "box one" })).toBe("/machines/box%20one");
    expect(pageHref(machine, { machine: "m" }, { q: "a&b", tab: "logs" })).toBe(
      "/machines/m?tab=logs&q=a%26b"
    );
    expect(pageHref(machine, { machine: "m" }, { tab: undefined })).toBe("/machines/m");
  });

  test("keeps the rest under a splat, and drops the slash when there is none", () => {
    expect(pageHref(issue.routes.issue, { key: "AB-1" })).toBe("/issues/AB-1");
    expect(pageHref(issue.routes.issue, { key: "AB-1", "*": "plan/step 2" })).toBe(
      "/issues/AB-1/plan/step%202"
    );
    expect(pageHref(inbox.routes.home, {})).toBe("/");
  });

  test("control: a missing param throws instead of writing a broken address", () => {
    const params: { machine: string } = JSON.parse('{"machine":""}');
    expect(() => pageHref(machine, params)).toThrow('/machines/:machine needs its "machine" param');
  });

  test("is typed from the route: a missing param or an unknown search key fails tsc", () => {
    // @ts-expect-error the route binds :machine
    expect(() => pageHref(machine, {})).toThrow();
    // @ts-expect-error the route reads no "sort" key
    expect(pageHref(machine, { machine: "m" }, { sort: "new" })).toBe("/machines/m");
  });

  test("the old Replies address lands where upstream's builder sends it", () => {
    expect(pageHref(inbox.routes.home, {}, { type: "reply" })).toBe(
      buildInboxPath({ filters: { type: ["reply"] } })
    );
  });
});
