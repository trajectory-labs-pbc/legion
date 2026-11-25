import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider, queryOptions, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { render, settle } from "../../tests/react";
import { PageLink, PREFETCH_INTENT_MS, Redirect } from "./page-link";
import { pageRoute, prefetchOf } from "./page-route";
import { MemoryNavigationProvider } from "./provider";

/** A read that waits until the test lets it answer, and records each start and abort. */
function slowRead() {
  const log: string[] = [];
  let answer = () => {};
  const options = queryOptions({
    queryKey: ["machine", "m"],
    queryFn: ({ signal }) =>
      new Promise<string>((resolve) => {
        log.push("start");
        signal.addEventListener("abort", () => log.push("abort"));
        answer = () => resolve("data");
      }),
  });
  return { log, options, answer: () => answer() };
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function mount(client: QueryClient, children: ReactNode) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path="/">{children}</MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  const link = view.container.querySelector("a");
  if (link === null) throw new Error("no link");
  return link;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fire = (link: HTMLElement, type: string) =>
  settle(() => {
    link.dispatchEvent(new Event(type, { bubbles: true }));
  });

function setup() {
  const read = slowRead();
  const page = pageRoute({
    path: "/machines/:machine",
    element: null,
    prefetch: () => [prefetchOf(read.options)],
  });
  return { read, page, client: new QueryClient() };
}

describe("PageLink", () => {
  test("links to the typed address", () => {
    const { page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    expect(link.getAttribute("href")).toBe("/machines/m");
  });

  test("starts the page's read once the pointer rests on it", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS + 50);
    expect(read.log).toEqual(["start"]);
    read.answer();
    await wait(0);
    expect(client.getQueryState(read.options.queryKey)?.status).toBe("success");
  });

  test("control: a pointer that passes through starts nothing", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    fire(link, "pointerout");
    await wait(PREFETCH_INTENT_MS + 50);
    expect(read.log).toEqual([]);
  });

  test("focus starts the read at once, and losing focus keeps it", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "focusin");
    await wait(0);
    expect(read.log).toEqual(["start"]);
    // The shell moves focus to the page after a click, before a lazy page reads.
    fire(link, "focusout");
    await wait(0);
    expect(read.log).toEqual(["start"]);
    read.answer();
    await wait(0);
    expect(client.getQueryState(read.options.queryKey)?.status).toBe("success");
  });

  test("the pointer leaving after a click keeps the read the click uses", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS + 50);
    fire(link, "click");
    fire(link, "pointerout");
    await wait(0);
    expect(read.log).toEqual(["start"]);
  });

  test("a quick click with no focus, as Safari's, keeps the read the wait then starts", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    fire(link, "click");
    await wait(PREFETCH_INTENT_MS + 50);
    fire(link, "pointerout");
    await wait(0);
    expect(read.log).toEqual(["start"]);
  });

  test("control: a click on an earlier visit does not keep a later visit's read", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    fire(link, "click");
    fire(link, "pointerout");
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS + 50);
    fire(link, "pointerout");
    await wait(0);
    expect(read.log).toEqual(["start", "abort"]);
  });

  test("control: the pointer leaving with no click stops a read nothing else watches", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS + 50);
    fire(link, "pointerout");
    await wait(0);
    expect(read.log).toEqual(["start", "abort"]);
    expect(client.getQueryState(read.options.queryKey)?.fetchStatus).toBe("idle");
  });

  test("the pointer must rest the whole wait: half of it starts nothing", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS / 2);
    expect(read.log).toEqual([]);
    await wait(PREFETCH_INTENT_MS);
    expect(read.log).toEqual(["start"]);
  });

  test("a link unmounted during the wait starts nothing", async () => {
    const { read, page, client } = setup();
    const link = mount(
      client,
      <PageLink page={page} params={{ machine: "m" }}>
        Box
      </PageLink>
    );
    fire(link, "pointerover");
    for (const view of mounted.splice(0)) view.unmount();
    await wait(PREFETCH_INTENT_MS + 50);
    expect(read.log).toEqual([]);
  });

  test("leaving keeps a read the page already watches", async () => {
    const { read, page, client } = setup();
    function Watcher() {
      useQuery(read.options);
      return null;
    }
    const link = mount(
      client,
      <>
        <Watcher />
        <PageLink page={page} params={{ machine: "m" }}>
          Box
        </PageLink>
      </>
    );
    fire(link, "pointerover");
    await wait(PREFETCH_INTENT_MS + 50);
    fire(link, "pointerout");
    await wait(0);
    expect(read.log).toEqual(["start"]);
  });

  test("takes no params for a page whose path binds none, and requires them where it does", () => {
    const { page, client } = setup();
    const home = pageRoute({ path: "/", element: null });
    const link = mount(client, <PageLink page={home}>Home</PageLink>);
    expect(link.getAttribute("href")).toBe("/");
    // @ts-expect-error the route binds :machine
    expect(() => render(<PageLink page={page}>Box</PageLink>)).toThrow();
  });
});

/** Where the router is, and how it got there: `PUSH /a` or `REPLACE /a`. */
function Place() {
  const kind = useNavigationType();
  const { pathname } = useLocation();
  return <output>{`${String(kind)} ${pathname}`}</output>;
}

function place(path: string, children: ReactNode) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path={path}>
        {children}
        <Place />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  return view.container;
}

describe("replace", () => {
  const machine = pageRoute({ path: "/machines/:machine", element: null });

  test.each([
    [true, "REPLACE /machines/m"],
    [false, "PUSH /machines/m"],
  ] as const)("a PageLink with replace %p moves by %p", (replace, moved) => {
    const container = place(
      "/",
      <PageLink page={machine} params={{ machine: "m" }} replace={replace}>
        Box
      </PageLink>
    );
    settle(() => container.querySelector("a")?.click());
    expect(container.querySelector("output")?.textContent).toBe(moved);
  });

  test("a Redirect replaces the address, so Back skips it", () => {
    function AtOld() {
      return useLocation().pathname === "/old" ? (
        <Redirect page={machine} params={{ machine: "m" }} />
      ) : null;
    }
    const container = place("/old", <AtOld />);
    expect(container.querySelector("output")?.textContent).toBe("REPLACE /machines/m");
  });
});
