import { NotFoundPage } from "@upstream-dispatch/features/shell/NotFoundPage";

import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

export const notFound = {
  id: "not-found",
  server: "upstream",
  routes: {
    any: pageRoute({ path: "/*", element: <NotFoundPage /> }),
  },
  // The shell owns NotFoundPage.tsx (src/views.ts).
  views: [],
} satisfies Page;
