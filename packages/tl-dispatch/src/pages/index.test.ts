import { describe, expect, test } from "bun:test";
import {
  buildInboxPath,
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@upstream-dispatch/features/refs/routes";
import { pageHref } from "@/navigation/page-route";
import { pageAt, pages } from "@/pages/index";
import { inbox } from "./inbox";
import type { PageLayout } from "./page";

describe("the route tree", () => {
  test("holds each path once", () => {
    const paths = pages.flatMap((page) => Object.values(page.routes).map((route) => route.path));
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  test("finds the page an address opens, with its params, as the router ranks routes", () => {
    const at = (path: string) => {
      const found = pageAt(path);
      return found && [found.page.id, found.route.path, found.params];
    };
    expect(at("/")).toEqual(["inbox", "/", {}]);
    expect(at("/issues/AB-1/plan")).toEqual([
      "issue",
      "/issues/:key/*",
      { key: "AB-1", "*": "plan" },
    ]);
    expect(at("/agents/broadcasts")).toEqual(["agents", "/agents/broadcasts", {}]);
    expect(at("/projects/AB/documents/spec")).toEqual([
      "document",
      "/projects/:key/documents/:slug",
      { key: "AB", slug: "spec" },
    ]);
    expect(at("/nowhere/at/all")?.[0]).toBe("not-found");
  });

  test("the old Replies address lands where upstream's builder sends it", () => {
    expect(pageHref(inbox.routes.home, {}, { type: "reply" })).toBe(
      buildInboxPath({ filters: { type: ["reply"] } })
    );
  });
});

/** Upstream's rules for the frame an address gets, which the shell read before pages declared it. */
function upstreamLayout(pathname: string, search: string) {
  const inbox = routeIsInbox(pathname);
  const fillsViewport: PageLayout["fillsViewport"] = routeFillsViewport(pathname)
    ? true
    : inbox && "reading-pane";
  return {
    fillsViewport,
    margin: routeHasMargin(pathname, search),
    outlineFrame: parseIssuePath(pathname, search) !== undefined,
    issue: parseIssuePath(pathname)?.key,
    project: routeProjectOf(pathname),
    inbox,
    liveView: liveViewSessionOf(pathname),
  };
}

function declaredLayout(pathname: string, search: string): ReturnType<typeof upstreamLayout> {
  const layout = pageAt(pathname, search)?.layout ?? {};
  return {
    fillsViewport: layout.fillsViewport ?? false,
    margin: layout.margin ?? false,
    outlineFrame: layout.outlineFrame ?? false,
    issue: layout.issue,
    project: layout.project,
    inbox: layout.inbox ?? false,
    liveView: layout.liveView,
  };
}

const ADDRESSES = [
  "/",
  "/?type=reply",
  "/answers",
  "/replies",
  "/credentials/abc",
  "/credentials/machine",
  "/credentials/machine/",
  "/agents",
  "/agents/s-1/live",
  "/agents/s-1/live/",
  "/agents/broadcasts",
  "/agents/broadcasts/b-1",
  "/agents/s-1/artifacts/notes",
  "/machines",
  "/machines/box%20one",
  "/issues/AB-1",
  "/issues/AB-1/",
  "/issues/ab-1",
  "/ISSUES/AB-1",
  "/issues/AB-0",
  "/issues/AB-1/plan",
  "/issues/AB-1/spec",
  "/issues/AB-1/conversation",
  "/issues/AB-1/artifact/notes",
  "/issues/AB-1/artifact/notes?v=2",
  "/issues/AB-1/artifact/notes?v=bad",
  "/issues/AB-1/asks/a1",
  "/issues/AB-1/asks/a%2Fb",
  "/issues/AB-1/nonsense",
  "/projects/AB",
  "/projects/ab",
  "/projects/AB/architecture",
  "/projects/AB/issues",
  "/projects/AB/documents",
  "/projects/AB/documents/spec",
  "/projects/AB/documents/spec?ask=a1",
  "/projects/AB/documents/spec?comment=c1",
  "/priorities",
  "/priorities/p1",
  "/settings",
  "/delivery",
  "/pipeline",
  "/nowhere/at/all",
];

describe("each page's layout", () => {
  test.each(ADDRESSES)("at %s, follows upstream's rules for the frame", (address) => {
    const url = new URL(address, "https://dispatch.test");
    expect(declaredLayout(url.pathname, url.search)).toEqual(
      upstreamLayout(url.pathname, url.search)
    );
  });
});
