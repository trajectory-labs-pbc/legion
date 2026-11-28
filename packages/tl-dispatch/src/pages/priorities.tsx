import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute, prefetchOf } from "@/navigation/page-route";
import { prioritiesQuery } from "@/upstream/queries";

import type { Page } from "./page";

const PrioritiesPage = lazyNamed(
  () => import("@/upstream/views/priorities/priorities"),
  "PrioritiesPage"
);
const PriorityPage = lazyNamed(
  () => import("@/upstream/views/priorities/priority"),
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
