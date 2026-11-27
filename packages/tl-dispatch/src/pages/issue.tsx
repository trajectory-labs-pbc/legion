import { issueQuery } from "@upstream-dispatch/api/queries";

import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const IssuePage = lazyNamed(
  () => import("@upstream-dispatch/features/issue-page/IssuePage"),
  "IssuePage"
);

export const issue = {
  id: "issue",
  server: "upstream",
  routes: {
    issue: pageRoute({
      path: "/issues/:key/*",
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
} satisfies Page;
