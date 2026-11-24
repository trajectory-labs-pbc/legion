import { lazy } from "react";

import type { Page } from "./page";

const IssuePage = lazy(() =>
  import("@upstream-dispatch/features/issue-page/IssuePage").then((module) => ({
    default: module.IssuePage,
  }))
);

export const issue: Page = {
  id: "issue",
  server: "upstream",
  routes: [{ path: "/issues/:key/*", element: <IssuePage /> }],
  views: [
    "features/issue/**",
    "features/issue-page/**",
    "features/verification/**",
    "features/plan/**",
    "features/steps/**",
    "features/threads/**",
  ],
};
