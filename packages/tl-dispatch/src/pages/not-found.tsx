import { pageRoute } from "@/navigation/page-route";
import { NotFound } from "./not-found/not-found";

import type { Page } from "./page";

export const notFound = {
  id: "not-found",
  server: "fork",
  routes: {
    any: pageRoute({ path: "/*", element: <NotFound /> }),
  },
  // Upstream's own pages still draw NotFoundPage.tsx, so the shell keeps it (src/views.ts).
  views: [],
} satisfies Page;
