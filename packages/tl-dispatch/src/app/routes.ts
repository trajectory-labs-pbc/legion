import { agents } from "@/features/agents/route";
import { delivery } from "@/features/delivery/route";
import { projectDocument } from "@/features/document/route";
import { inbox } from "@/features/inbox/route";
import { issue } from "@/features/issue/route";
import { machineLogin } from "@/features/machine-login/route";
import { machines } from "@/features/machines/route";
import { notFound } from "@/features/not-found/route";
import { people } from "@/features/people/route";
import { priorities } from "@/features/priorities/route";
import { project } from "@/features/project/route";
import { settings } from "@/features/settings/route";
import { type Page, upstreamLayout } from "@/navigation/page";
import type { PageLayout } from "@/shell/page-layout";

/** Each page of the app, from its route file. */
const routeFiles = [
  inbox,
  agents,
  machines,
  issue,
  priorities,
  project,
  projectDocument,
  machineLogin,
  settings,
  delivery,
  people,
  notFound,
] as const satisfies readonly Page<PageLayout>[];

/** The route map: every page and the routes it serves. A route of a page upstream draws takes
 *  upstream's frame, unless it declares its own. */
export const pages: readonly Page<PageLayout>[] = routeFiles.map((page: Page<PageLayout>) =>
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
