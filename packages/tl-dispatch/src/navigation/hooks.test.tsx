import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render, settle } from "../../tests/react";
import { useAddress, usePageNavigate, usePageParams, usePageSearch } from "./hooks";
import { pageRoute } from "./page-route";
import { MemoryNavigationProvider } from "./provider";
import { PageRoutes, useCurrentPage } from "./route-tree";

const machine = pageRoute({ path: "/machines/:machine", element: null, search: ["tab"] });

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function probe<T>(path: string, read: () => T): { value: () => T | Error } {
  let value: T | Error = new Error("not rendered");
  function Probe() {
    try {
      value = read();
    } catch (error) {
      value = error instanceof Error ? error : new Error(String(error));
    }
    return null;
  }
  mounted.push(
    render(
      <MemoryNavigationProvider path={path}>
        <Probe />
      </MemoryNavigationProvider>
    )
  );
  return { value: () => value };
}

describe("the page hooks", () => {
  test("usePageParams reads the page's params; off the page it throws", () => {
    expect(probe("/machines/box%201", () => usePageParams(machine)).value()).toEqual({
      machine: "box 1",
    });
    expect(String(probe("/agents", () => usePageParams(machine)).value())).toContain(
      "not on /machines/:machine"
    );
  });

  test("usePageSearch reads only the keys the page declares", () => {
    expect(probe("/machines/m?tab=logs&other=1", () => usePageSearch(machine)).value()).toEqual({
      tab: "logs",
    });
  });

  test("usePageNavigate moves to the typed address", () => {
    let go: ReturnType<typeof usePageNavigate> = () => {};
    const address = probe("/", () => {
      go = usePageNavigate();
      return useAddress();
    });
    settle(() => go(machine, { machine: "m" }, { search: { tab: "logs" } }));
    expect(address.value()).toEqual({ pathname: "/machines/m", search: "?tab=logs" });
  });

  test("useCurrentPage follows the address", () => {
    expect(probe("/priorities/7", () => useCurrentPage()?.page.id).value()).toBe("priorities");
  });

  test("PageRoutes draws the route's element", () => {
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryNavigationProvider path="/nowhere">
          <PageRoutes />
        </MemoryNavigationProvider>
      </QueryClientProvider>
    );
    mounted.push(view);
    expect(view.container.textContent).toContain("not found");
  });
});
