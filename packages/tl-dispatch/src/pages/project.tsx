import { lazy } from "react";

import type { Page } from "./page";

const ProjectPage = lazy(() =>
  import("@upstream-dispatch/features/project/ProjectPage").then((module) => ({
    default: module.ProjectPage,
  }))
);

export const project: Page = {
  id: "project",
  server: "upstream",
  routes: [
    { path: "/projects/:key", element: <ProjectPage /> },
    { path: "/projects/:key/architecture", element: <ProjectPage /> },
    { path: "/projects/:key/issues", element: <ProjectPage /> },
    { path: "/projects/:key/documents", element: <ProjectPage /> },
  ],
  views: ["features/project/**", "features/architecture/**"],
};
