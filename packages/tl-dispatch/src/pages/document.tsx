import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const DocumentPage = lazyNamed(
  () => import("@upstream-dispatch/features/document/DocumentPage"),
  "DocumentPage"
);

export const projectDocument = {
  id: "document",
  server: "upstream",
  routes: {
    document: pageRoute({ path: "/projects/:key/documents/:slug", element: <DocumentPage /> }),
  },
  views: ["features/document/**"],
} satisfies Page;
