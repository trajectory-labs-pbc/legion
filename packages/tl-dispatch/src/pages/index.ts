import { createRouteTree } from "@/navigation/route-tree";

import { agents } from "./agents";
import { credentials } from "./credentials";
import { delivery } from "./delivery";
import { projectDocument } from "./document";
import { inbox } from "./inbox";
import { issue } from "./issue";
import { machines } from "./machines";
import { notFound } from "./not-found";
import { type Page, type PageLayout, upstreamLayout } from "./page";
import { people } from "./people";
import { priorities } from "./priorities";
import { project } from "./project";
import { settings } from "./settings";

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
  people,
  notFound,
] as const satisfies readonly Page[];

/** Each route of a page upstream draws takes upstream's frame, unless it declares its own. */
const framed = pages.map((page) =>
  page.server === "fork"
    ? page
    : {
        ...page,
        routes: Object.fromEntries(
          Object.entries(page.routes).map(([name, route]) => [
            name,
            route.layout === undefined ? { ...route, layout: upstreamLayout } : route,
          ])
        ),
      }
);

/** The pages' route tree: the outlet, and the page an address opens with its layout. */
export const { PageRoutes, pageAt, useCurrentPage } = createRouteTree<PageLayout, Page>(framed);
