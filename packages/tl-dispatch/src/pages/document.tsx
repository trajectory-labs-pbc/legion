import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const AidedDocumentPage = lazyNamed(
  () => import("@/features/reading-aids/document-host"),
  "AidedDocumentPage"
);

export const projectDocument = {
  id: "document",
  server: "upstream",
  routes: {
    document: pageRoute({ path: "/projects/:key/documents/:slug", element: <AidedDocumentPage /> }),
  },
  views: ["features/document/**"],
} satisfies Page;
