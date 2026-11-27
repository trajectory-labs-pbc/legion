import { afterEach, describe, expect, test } from "bun:test";
import { useNavigationType } from "react-router-dom";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle } from "../../tests/react";
import { useAddress, usePageNavigate, usePageParams, usePageSearch } from "./hooks";
import { type PageRoute, pageRoute } from "./page-route";
import { createRouteTree } from "./route-tree";

const machine = pageRoute({ path: "/machines/:machine", element: null, search: ["tab"] });

// The tree of a small app: navigation's tests name none of the app's pages.
type TestPage = { id: string; routes: Record<string, PageRoute<string, string, unknown>> };
const { PageRoutes, useCurrentPage } = createRouteTree<unknown, TestPage>([
  { id: "machines", routes: { machine } },
  { id: "issue", routes: { issue: pageRoute({ path: "/issues/:key/*", element: null }) } },
  { id: "not-found", routes: { any: pageRoute({ path: "/*", element: "nothing here" }) } },
]);

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
    settle(() => go(machine, { params: { machine: "m" }, search: { tab: "logs" } }));
    expect(address.value()).toEqual({ pathname: "/machines/m", search: "?tab=logs" });
  });

  test("PageRoutes draws the route's element", () => {
    const view = render(
      <MemoryNavigationProvider path="/nowhere">
        <PageRoutes />
      </MemoryNavigationProvider>
    );
    mounted.push(view);
    expect(view.container.textContent).toBe("nothing here");
  });

  test("usePageNavigate replaces the address when asked, and pushes otherwise", () => {
    let go: ReturnType<typeof usePageNavigate> = () => {};
    const kind = probe("/", () => {
      go = usePageNavigate();
      return useNavigationType();
    });
    settle(() => go(machine, { params: { machine: "m" }, replace: true }));
    expect(String(kind.value())).toBe("REPLACE");
    settle(() => go(machine, { params: { machine: "n" } }));
    expect(String(kind.value())).toBe("PUSH");
  });

  test("usePageSearch off the page throws", () => {
    expect(String(probe("/agents?tab=logs", () => usePageSearch(machine)).value())).toContain(
      "not on /machines/:machine"
    );
  });

  test("useCurrentPage names the route and its params, and follows a move", () => {
    let go: ReturnType<typeof usePageNavigate> = () => {};
    const current = probe("/issues/AB-1/plan", () => {
      go = usePageNavigate();
      const found = useCurrentPage();
      return `${found?.page.id}.${found?.route.path} ${JSON.stringify(found?.params)}`;
    });
    expect(current.value()).toBe('issue./issues/:key/* {"key":"AB-1","*":"plan"}');
    settle(() => go(machine, { params: { machine: "m" } }));
    expect(current.value()).toBe('machines./machines/:machine {"machine":"m"}');
  });
});
