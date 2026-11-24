import { lazy } from "react";

import type { Page } from "./page";

const PrioritiesPage = lazy(() =>
  import("@upstream-dispatch/features/priorities/PrioritiesPage").then((module) => ({
    default: module.PrioritiesPage,
  }))
);
const PriorityPage = lazy(() =>
  import("@upstream-dispatch/features/priorities/PriorityPage").then((module) => ({
    default: module.PriorityPage,
  }))
);

export const priorities: Page = {
  id: "priorities",
  server: "upstream",
  routes: [
    { path: "/priorities", element: <PrioritiesPage /> },
    { path: "/priorities/:id", element: <PriorityPage /> },
  ],
  views: ["features/priorities/**"],
};
