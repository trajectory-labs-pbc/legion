import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isValidElement } from "react";
import { Route, Routes } from "react-router-dom";
import { inbox } from "@/features/inbox/route";
import { useAddress } from "@/navigation/hooks";
import { pageHref, pageRoute } from "@/navigation/page-route";
import { PageRoutes } from "@/navigation/route-tree";
import { routes } from "@/navigation/routes";
import type { AppPage, PageLayout } from "@/shell/page-layout";
import {
  buildInboxPath,
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@/upstream/routes";

import { pageAt, renderApp } from "../../tests/app";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render } from "../../tests/react";
import { SRC_DIR } from "../../tests/source";
import { pages } from "./routes";

/** The features that have a route file: one for each page. */
function routeFiles(): string[] {
  const features = join(SRC_DIR, "features");
  return readdirSync(features).filter((name) =>
    ["route.tsx", "route.ts"].some((route) => existsSync(join(features, name, route)))
  );
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

describe("the route map", () => {
  test("holds each route file, named by its page's id, and a page for each entry of routes", () => {
    expect(pages.map((page) => page.id).sort()).toEqual(routeFiles().sort());
    expect(Object.keys(routes).sort()).toEqual(routeFiles().sort());
  });

  test("each route file serves the addresses its routes entry gives, or tsc fails", () => {
    type Machines = typeof routes.machines;
    const list = pageRoute({ ...routes.machines.list, element: null });
    const machine = pageRoute({ ...routes.machines.machine, element: null });
    const page = { id: "machines", server: "upstream", views: [] } as const;
    const pages = [
      { ...page, routes: { list, machine } } satisfies AppPage<Machines>,
      // @ts-expect-error the page misses its machine route
      { ...page, routes: { list } } satisfies AppPage<Machines>,
      // @ts-expect-error the page adds a route its entry does not name
      { ...page, routes: { list, machine, other: list } } satisfies AppPage<Machines>,
      // @ts-expect-error the page puts its list route on the machine's address
      { ...page, routes: { list: machine, machine } } satisfies AppPage<Machines>,
      // @ts-expect-error the page names another page's id
      { ...page, id: "agents", routes: { list, machine } } satisfies AppPage<Machines>,
    ];
    expect(pages).toHaveLength(5);
  });

  test("PageRoutes draws the page an address opens", () => {
    mounted.push(renderApp(<PageRoutes />, { path: "/nowhere" }));
    expect(document.body.textContent).toContain("not found");
  });

  test("SHL-42 the old Replies address replaces itself with the Inbox's reply rows", () => {
    const Address = () => {
      const { pathname, search } = useAddress();
      return <p>{pathname + search}</p>;
    };
    const view = render(
      <MemoryNavigationProvider path="/replies">
        <Routes>
          <Route element={inbox.routes.replies.element} path={inbox.routes.replies.path} />
          <Route element={<Address />} path={inbox.routes.home.path} />
        </Routes>
      </MemoryNavigationProvider>
    );
    mounted.push(view);
    expect(view.container.textContent).toBe("/?type=reply");
  });
});

describe("the route tree", () => {
  test("holds each path once", () => {
    const paths = pages.flatMap((page) => Object.values(page.routes).map((route) => route.path));
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  test("SHL-41 finds the page an address opens, with its params, as the router ranks routes", () => {
    const at = (path: string) => {
      const found = pageAt(path);
      return found && [found.page.id, found.route.path, found.params];
    };
    expect(at("/")).toEqual(["inbox", "/", {}]);
    // The old credentials addresses draw the Inbox, except the machine login page.
    expect(at("/credentials/abc")?.slice(0, 2)).toEqual(["inbox", "/credentials/*"]);
    const element = pageAt("/credentials/abc")?.route.element;
    const home = inbox.routes.home.element;
    expect(isValidElement(element) && isValidElement(home) && element.type).toBe(
      isValidElement(home) && home.type
    );
    expect(at("/credentials/machine")?.[0]).toBe("machine-login");
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

  test("SHL-42 the old Replies address lands where upstream's builder sends it", () => {
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
  "/people/someone",
  "/priorities",
  "/priorities/p1",
  "/settings",
  "/delivery",
  "/pipeline",
  "/nowhere/at/all",
];

describe("each page's layout", () => {
  test.each(ADDRESSES)("SHL-30 at %s, follows upstream's rules for the frame", (address) => {
    const url = new URL(address, "https://dispatch.test");
    expect(declaredLayout(url.pathname, url.search)).toEqual(
      upstreamLayout(url.pathname, url.search)
    );
  });
});
