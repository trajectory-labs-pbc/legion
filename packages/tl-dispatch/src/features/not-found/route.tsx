import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";
// Upstream draws it at first paint, so it loads with the entry (tests/layers.table.ts, EAGER).
import { NotFoundPage } from "./page";

export const notFound = {
  id: "not-found",
  server: "fork",
  routes: {
    any: pageRoute({ ...routes["not-found"].any, element: <NotFoundPage /> }),
  },
  // Upstream's own pages still draw NotFoundPage.tsx, so the shell keeps it (src/views.ts).
  views: [],
} satisfies AppPage<(typeof routes)["not-found"]>;
