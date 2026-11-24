import { useMemo } from "react";
import { matchRoutes, type RouteObject, useLocation, useRoutes } from "react-router-dom";

import { agents } from "@/pages/agents";
import { credentials } from "@/pages/credentials";
import { delivery } from "@/pages/delivery";
import { projectDocument } from "@/pages/document";
import { inbox } from "@/pages/inbox";
import { issue } from "@/pages/issue";
import { machines } from "@/pages/machines";
import { notFound } from "@/pages/not-found";
import type { Page } from "@/pages/page";
import { priorities } from "@/pages/priorities";
import { project } from "@/pages/project";
import { settings } from "@/pages/settings";
import type { PageRoute } from "./page-route";

/** The route map: every page and the routes it serves. */
export const pages = [
  inbox,
  agents,
  machines,
  issue,
  priorities,
  project,
  projectDocument,
  credentials,
  settings,
  delivery,
  notFound,
] as const satisfies readonly Page[];

const ROUTES: readonly { id: string; page: Page; route: PageRoute }[] = pages.flatMap(
  (page: Page) =>
    Object.entries(page.routes).map(([name, route]) => ({ id: `${page.id}.${name}`, page, route }))
);

const ROUTE_OBJECTS: RouteObject[] = ROUTES.map(({ id, route }) => ({
  id,
  path: route.path,
  element: route.element,
}));

/** The page drawn at the address. */
export function PageRoutes() {
  return useRoutes(ROUTE_OBJECTS);
}

export interface CurrentPage {
  page: Page;
  route: PageRoute;
  params: Readonly<Record<string, string | undefined>>;
}

/** The page and route an address opens, ranked as the router ranks them. */
export function pageAt(pathname: string): CurrentPage | undefined {
  const match = matchRoutes(ROUTE_OBJECTS, pathname)?.at(-1);
  const found = ROUTES.find(({ id }) => id === match?.route.id);
  return match === undefined || found === undefined
    ? undefined
    : { page: found.page, route: found.route, params: match.params };
}

/** The page the address is on. */
export function useCurrentPage(): CurrentPage | undefined {
  const { pathname } = useLocation();
  return useMemo(() => pageAt(pathname), [pathname]);
}
