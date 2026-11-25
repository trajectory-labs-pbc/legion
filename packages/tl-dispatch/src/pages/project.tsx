import { routeProjectOf } from "@upstream-dispatch/features/refs/routes";

import { lazyNamed } from "@/loading/lazy-named";
import { type PageAddress, pageRoute } from "@/navigation/page-route";

import type { Page, PageLayout } from "./page";

const ProjectPage = lazyNamed(
  () => import("@upstream-dispatch/features/project/ProjectPage"),
  "ProjectPage"
);

const layout = ({ pathname }: PageAddress): PageLayout => ({
  project: routeProjectOf(pathname),
});

export const project = {
  id: "project",
  server: "upstream",
  routes: {
    overview: pageRoute({ path: "/projects/:key", element: <ProjectPage />, layout }),
    architecture: pageRoute({
      path: "/projects/:key/architecture",
      element: <ProjectPage />,
      layout,
    }),
    issues: pageRoute({ path: "/projects/:key/issues", element: <ProjectPage />, layout }),
    documents: pageRoute({ path: "/projects/:key/documents", element: <ProjectPage />, layout }),
  },
  views: ["features/project/**", "features/architecture/**"],
} satisfies Page;
