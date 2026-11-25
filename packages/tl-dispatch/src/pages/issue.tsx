import { issueQuery } from "@upstream-dispatch/api/queries";
import {
  parseIssuePath,
  routeHasMargin,
  routeProjectOf,
} from "@upstream-dispatch/features/refs/routes";
import { lazy } from "react";

import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const IssuePage = lazy(() =>
  import("@upstream-dispatch/features/issue-page/IssuePage").then((module) => ({
    default: module.IssuePage,
  }))
);

export const issue = {
  id: "issue",
  server: "upstream",
  routes: {
    issue: pageRoute({
      path: "/issues/:key/*",
      element: <IssuePage />,
      prefetch: ({ key }) => [prefetchOf(issueQuery(key))],
      layout: ({ pathname, search }) => ({
        margin: routeHasMargin(pathname, search),
        outlineFrame: parseIssuePath(pathname, search) !== undefined,
        issue: parseIssuePath(pathname)?.key,
        project: routeProjectOf(pathname),
      }),
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
