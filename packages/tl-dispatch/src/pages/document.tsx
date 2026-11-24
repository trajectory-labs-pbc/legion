import { lazy } from "react";

import type { Page } from "./page";

const DocumentPage = lazy(() =>
  import("@upstream-dispatch/features/document/DocumentPage").then((module) => ({
    default: module.DocumentPage,
  }))
);

export const projectDocument: Page = {
  id: "document",
  server: "upstream",
  routes: [{ path: "/projects/:key/documents/:slug", element: <DocumentPage /> }],
  views: ["features/document/**"],
};
