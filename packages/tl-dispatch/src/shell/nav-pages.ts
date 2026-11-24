import type { NavName } from "@/commands/nav";
import type { PageRoute } from "@/navigation/page-route";
import { agents } from "@/pages/agents";
import { delivery } from "@/pages/delivery";
import { inbox } from "@/pages/inbox";
import { machines } from "@/pages/machines";
import { priorities } from "@/pages/priorities";
import { settings } from "@/pages/settings";

/** The route each sidebar destination opens; its label, icon and key are the nav table's. */
export const NAV_PAGES = {
  inbox: inbox.routes.home,
  agents: agents.routes.list,
  priorities: priorities.routes.list,
  delivery: delivery.routes.delivery,
  pipeline: delivery.routes.pipeline,
  machines: machines.routes.list,
  settings: settings.routes.settings,
} as const satisfies Readonly<Record<NavName, PageRoute<string, string>>>;

/** A destination stays lit on the pages under it: Priorities on one priority's page. */
export function navLit(route: PageRoute<string, string>, pathname: string): boolean {
  return pathname === route.path || (route.path !== "/" && pathname.startsWith(`${route.path}/`));
}
