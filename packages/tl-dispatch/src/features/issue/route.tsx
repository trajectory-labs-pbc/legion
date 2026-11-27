import { prefetchOf } from "@/data/prefetch";
import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";
import { issueQuery } from "@/upstream/queries";

const IssuePage = lazyNamed(() => import("./page"), "IssuePage");

export const issue = {
  id: "issue",
  server: "upstream",
  routes: {
    issue: pageRoute({
      ...routes.issue.issue,
      element: <IssuePage />,
      prefetch: ({ key }) => [prefetchOf(issueQuery(key))],
    }),
  },
  views: [
    "features/issue/**",
    "features/issue-page/**",
    "features/verification/**",
    "features/plan/**",
    "features/steps/**",
    "features/threads/**",
    // Files of other folders only the issue page renders.
    "features/priorities/IssuePriorityLine.tsx",
  ],
} satisfies AppPage<typeof routes.issue>;
