import { prefetchOf } from "@/data/prefetch";
import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";
import { prioritiesQuery } from "@/upstream/queries";

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
      ...routes.priorities.list,
      element: <PrioritiesPage />,
      prefetch: () => [prefetchOf(prioritiesQuery())],
    }),
    priority: pageRoute({ ...routes.priorities.priority, element: <PriorityPage /> }),
  },
  views: ["features/priorities/**"],
} satisfies AppPage<typeof routes.priorities>;
