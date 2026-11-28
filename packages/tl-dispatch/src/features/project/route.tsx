import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const ProjectPage = lazyNamed(() => import("@/upstream/views/project"), "ProjectPage");

export const project = {
  id: "project",
  server: "upstream",
  routes: {
    overview: pageRoute({ ...routes.project.overview, element: <ProjectPage /> }),
    architecture: pageRoute({ ...routes.project.architecture, element: <ProjectPage /> }),
    issues: pageRoute({ ...routes.project.issues, element: <ProjectPage /> }),
    documents: pageRoute({ ...routes.project.documents, element: <ProjectPage /> }),
  },
  views: ["features/project/**", "features/architecture/**"],
} satisfies AppPage<typeof routes.project>;
