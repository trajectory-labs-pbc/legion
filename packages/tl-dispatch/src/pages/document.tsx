import { routeHasMargin, routeProjectOf } from "@upstream-dispatch/features/refs/routes";

import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page, PageLayout } from "./page";

const DocumentPage = lazyNamed(
  () => import("@upstream-dispatch/features/document/DocumentPage"),
  "DocumentPage"
);

export const projectDocument = {
  id: "document",
  server: "upstream",
  routes: {
    document: pageRoute({
      path: "/projects/:key/documents/:slug",
      element: <DocumentPage />,
      layout: ({ pathname, search }): PageLayout => ({
        margin: routeHasMargin(pathname, search),
        project: routeProjectOf(pathname),
      }),
    }),
  },
  views: ["features/document/**"],
} satisfies Page;
