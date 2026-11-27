import { agents } from "@/pages/agents";
import { credentials } from "@/pages/credentials";
import { delivery } from "@/pages/delivery";
import { projectDocument } from "@/pages/document";
import { inbox } from "@/pages/inbox";
import { issue } from "@/pages/issue";
import { machineLogin } from "@/pages/machine-login";
import { machines } from "@/pages/machines";
import { notFound } from "@/pages/not-found";
import { type Page, upstreamLayout } from "@/pages/page";
import { people } from "@/pages/people";
import { priorities } from "@/pages/priorities";
import { project } from "@/pages/project";
import { settings } from "@/pages/settings";

/** Each page of the app, from its route file. */
const routeFiles = [
  inbox,
  agents,
  machines,
  issue,
  priorities,
  project,
  projectDocument,
  credentials,
  machineLogin,
  settings,
  delivery,
  people,
  notFound,
] as const satisfies readonly Page[];

/** The route map: every page and the routes it serves. A route of a page upstream draws takes
 *  upstream's frame, unless it declares its own. */
export const pages: readonly Page[] = routeFiles.map((page: Page) =>
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
