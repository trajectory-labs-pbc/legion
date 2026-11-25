import { routeHasMargin, routeProjectOf } from "@upstream-dispatch/features/refs/routes";
import { lazy } from "react";

import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const DocumentPage = lazy(() =>
  import("@upstream-dispatch/features/document/DocumentPage").then((module) => ({
    default: module.DocumentPage,
  }))
);

export const projectDocument = {
  id: "document",
  server: "upstream",
  routes: {
    document: pageRoute({
      path: "/projects/:key/documents/:slug",
      element: <DocumentPage />,
      layout: ({ pathname, search }) => ({
        margin: routeHasMargin(pathname, search),
        project: routeProjectOf(pathname),
      }),
    }),
  },
  views: ["features/document/**"],
} satisfies Page;
