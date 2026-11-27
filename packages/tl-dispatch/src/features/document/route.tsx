import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const DocumentPage = lazyNamed(() => import("@/upstream/views/document"), "DocumentPage");

export const projectDocument = {
  id: "document",
  server: "upstream",
  routes: {
    document: pageRoute({ ...routes.document.document, element: <DocumentPage /> }),
  },
  views: ["features/document/**"],
} satisfies AppPage<typeof routes.document>;
