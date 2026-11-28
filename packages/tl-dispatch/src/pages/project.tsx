import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const ProjectPage = lazyNamed(() => import("@/upstream/views/project"), "ProjectPage");

export const project = {
  id: "project",
  server: "upstream",
  routes: {
    overview: pageRoute({ path: "/projects/:key", element: <ProjectPage /> }),
    architecture: pageRoute({ path: "/projects/:key/architecture", element: <ProjectPage /> }),
    issues: pageRoute({ path: "/projects/:key/issues", element: <ProjectPage /> }),
    documents: pageRoute({ path: "/projects/:key/documents", element: <ProjectPage /> }),
  },
  views: ["features/project/**", "features/architecture/**"],
} satisfies Page;
