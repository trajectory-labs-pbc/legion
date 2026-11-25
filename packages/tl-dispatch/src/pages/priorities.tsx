import { prioritiesQuery } from "@upstream-dispatch/api/queries";

import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const PrioritiesPage = lazyNamed(
  () => import("@upstream-dispatch/features/priorities/PrioritiesPage"),
  "PrioritiesPage"
);
const PriorityPage = lazyNamed(
  () => import("@upstream-dispatch/features/priorities/PriorityPage"),
  "PriorityPage"
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
