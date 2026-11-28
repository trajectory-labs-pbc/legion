import { createContext, type ReactNode, useContext, useMemo } from "react";
import { matchRoutes, type RouteObject, useLocation, useRoutes } from "react-router-dom";

import { layoutAt, type PageRoute } from "./page-route";
import { routerPath } from "./router-path";

/** What the route tree reads of a page: its named routes. */
interface RoutedPage<Layout> {
  readonly routes: Readonly<Record<string, PageRoute<string, string, Layout>>>;
}

interface CurrentPage<Page, Layout> {
  page: Page;
  route: PageRoute<string, string, Layout>;
  params: Readonly<Record<string, string | undefined>>;
  /** The layout the route declares for the address; none where it declares none. */
  layout: Layout | undefined;
}

interface RouteTree<Page, Layout> {
  /** The router's routes: one for each route of each page. */
  routes: RouteObject[];
  /** The page and route an address opens, ranked as the router ranks them, with its layout. */
  pageAt(pathname: string, search?: string): CurrentPage<Page, Layout> | undefined;
}

/** The route tree of the app's pages, which the app hands over: navigation names none of them. */
export function createRouteTree<Layout, Page extends RoutedPage<Layout>>(
  pages: readonly Page[]
): RouteTree<Page, Layout> {
  type Routed = Pick<CurrentPage<Page, Layout>, "page" | "route">;
  const routes: RouteObject[] = pages.flatMap((page) =>
    Object.values(page.routes).map((route) => ({
      path: routerPath(route.path),
      element: route.element,
      handle: { page, route } satisfies Routed,
    }))
  );
  return {
    routes,
    pageAt(pathname, search = "") {
      const match = matchRoutes(routes, pathname)?.at(-1);
      if (match === undefined) return undefined;
      const { page, route } = match.route.handle as Routed;
      return { page, route, params: match.params, layout: layoutAt(route, { pathname, search }) };
    },
  };
}

// The app's one route tree. Its readers name the page and layout types the app gave it.
const TreeContext = createContext<RouteTree<unknown, unknown> | undefined>(undefined);

/** Gives the app's pages to the route tree: `PageRoutes` and `useCurrentRoute` read them. */
export function RouteProvider({
  pages,
  children,
}: {
  pages: readonly RoutedPage<unknown>[];
  children: ReactNode;
}) {
  const tree = useMemo(() => createRouteTree(pages), [pages]);
  return <TreeContext.Provider value={tree}>{children}</TreeContext.Provider>;
}

/** The route tree of the app's pages; outside the `RouteProvider` it throws. */
function useRouteTree<Page, Layout>(): RouteTree<Page, Layout> {
  const tree = useContext(TreeContext);
  if (tree === undefined) throw new Error("a route is read outside the app's RouteProvider");
  return tree as RouteTree<Page, Layout>;
}

/** The page drawn at the address. */
export const PageRoutes = (): ReactNode => useRoutes(useRouteTree().routes);

/** The page the address is on, with the layout type its routes declare. */
export function useCurrentRoute<Layout, Page = RoutedPage<Layout>>():
  | CurrentPage<Page, Layout>
  | undefined {
  const tree = useRouteTree<Page, Layout>();
  const { pathname, search } = useLocation();
  return useMemo(() => tree.pageAt(pathname, search), [tree, pathname, search]);
}
