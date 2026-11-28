import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
// Drawn at first paint before the features move.
import { NotFound } from "@/pages/not-found/not-found";
import type { AppPage } from "@/shell/page-layout";

export const notFound = {
  id: "not-found",
  server: "fork",
  routes: {
    any: pageRoute({ ...routes["not-found"].any, element: <NotFound /> }),
  },
  // Upstream's own pages still draw NotFoundPage.tsx, so the shell keeps it (src/views.ts).
  views: [],
} satisfies AppPage<(typeof routes)["not-found"]>;
