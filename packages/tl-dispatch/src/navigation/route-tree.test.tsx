import { describe, expect, test } from "bun:test";

import { pageRoute } from "./page-route";
import { createRouteTree } from "./route-tree";

const machines = {
  routes: {
    list: pageRoute({ path: "/machines", element: null, layout: "wide" }),
    one: pageRoute({
      path: "/machines/:machine",
      element: null,
      layout: ({ search }: { search: string }) => (search === "?full=1" ? "full" : "narrow"),
    }),
  },
};
const newMachine = { routes: { form: pageRoute({ path: "/machines/new", element: null }) } };
const tree = createRouteTree([machines, newMachine]);

describe("pageAt", () => {
  test("names the page and route the router ranks first, with params and layout", () => {
    expect(tree.pageAt("/machines/m", "?full=1")).toEqual({
      page: machines,
      route: machines.routes.one,
      params: { machine: "m" },
      layout: "full",
    });
    // A static segment outranks a param, whatever order the pages come in.
    expect(tree.pageAt("/machines/new")?.route).toBe(newMachine.routes.form);
    expect(tree.pageAt("/machines")?.layout).toBe("wide");
  });

  test("names nothing for an address no route opens", () => {
    expect(tree.pageAt("/nowhere")).toBeUndefined();
  });
});
