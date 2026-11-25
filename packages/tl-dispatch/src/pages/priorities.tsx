import { prioritiesQuery } from "@upstream-dispatch/api/queries";
import { lazy } from "react";

import { pageRoute, prefetchOf } from "@/navigation/page-route";

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

export const priorities = {
  id: "priorities",
  server: "upstream",
  routes: {
    list: pageRoute({
      path: "/priorities",
      element: <PrioritiesPage />,
      prefetch: () => [prefetchOf(prioritiesQuery())],
    }),
    priority: pageRoute({ path: "/priorities/:id", element: <PriorityPage /> }),
  },
  views: ["features/priorities/**"],
} satisfies Page;
