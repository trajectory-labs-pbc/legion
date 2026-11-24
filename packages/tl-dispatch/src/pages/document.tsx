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
    document: pageRoute({ path: "/projects/:key/documents/:slug", element: <DocumentPage /> }),
  },
  views: ["features/document/**"],
} satisfies Page;
