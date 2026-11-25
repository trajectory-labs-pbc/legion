import { type ReactNode, useMemo } from "react";
import { matchRoutes, type RouteObject, useLocation, useRoutes } from "react-router-dom";

import { layoutAt, type PageRoute } from "./page-route";
import { routerPath } from "./router-path";

/** What the route tree reads of a page: its id and its named routes. */
interface RoutedPage<Layout> {
  readonly id: string;
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
  /** The page drawn at the address. */
  PageRoutes(): ReactNode;
  /** The page and route an address opens, ranked as the router ranks them, with its layout. */
  pageAt(pathname: string, search?: string): CurrentPage<Page, Layout> | undefined;
  /** The page the address is on. */
  useCurrentPage(): CurrentPage<Page, Layout> | undefined;
}

/** The route tree of the app's pages, which the app hands over: navigation names none of them. */
export function createRouteTree<Layout, Page extends RoutedPage<Layout>>(
  pages: readonly Page[]
): RouteTree<Page, Layout> {
  const routes = pages.flatMap((page) =>
    Object.entries(page.routes).map(([name, route]) => ({ id: `${page.id}.${name}`, page, route }))
  );
  const routeObjects: RouteObject[] = routes.map(({ id, route }) => ({
    id,
    path: routerPath(route.path),
    element: route.element,
  }));
  const pageAt = (pathname: string, search = ""): CurrentPage<Page, Layout> | undefined => {
    const match = matchRoutes(routeObjects, pathname)?.at(-1);
    const found = routes.find(({ id }) => id === match?.route.id);
    return match === undefined || found === undefined
      ? undefined
      : {
          page: found.page,
          route: found.route,
          params: match.params,
          layout: layoutAt(found.route, { pathname, search }),
        };
  };
  return {
    PageRoutes: () => useRoutes(routeObjects),
    pageAt,
    useCurrentPage() {
      const { pathname, search } = useLocation();
      return useMemo(() => pageAt(pathname, search), [pathname, search]);
    },
  };
}
