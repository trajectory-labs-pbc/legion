import { routeProjectOf } from "@upstream-dispatch/features/refs/routes";
import { lazy } from "react";

import { type PageAddress, pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const ProjectPage = lazy(() =>
  import("@upstream-dispatch/features/project/ProjectPage").then((module) => ({
    default: module.ProjectPage,
  }))
);

const layout = ({ pathname }: PageAddress) => ({ project: routeProjectOf(pathname) });

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
