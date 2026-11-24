import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider, queryOptions, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { render, settle } from "../../tests/react";
import { PageLink, PREFETCH_INTENT_MS } from "./page-link";
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
});
