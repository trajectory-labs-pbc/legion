import { issueQuery } from "@upstream-dispatch/api/queries";

import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const AidedIssuePage = lazyNamed(
  () => import("@/features/reading-aids/issue-host"),
  "AidedIssuePage"
);

export const issue = {
  id: "issue",
  server: "upstream",
  routes: {
    issue: pageRoute({
      path: "/issues/:key/*",
      element: <AidedIssuePage />,
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
