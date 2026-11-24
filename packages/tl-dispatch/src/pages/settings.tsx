import { lazy } from "react";

import type { Page } from "./page";

const SettingsPage = lazy(() =>
  import("@upstream-dispatch/features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  }))
);

export const settings: Page = {
  id: "settings",
  server: "upstream",
  routes: [{ path: "/settings", element: <SettingsPage /> }],
  views: [
    "features/settings/**",
    // Files of other folders only Settings renders.
    "features/credentials/GrantsSection.tsx",
    "features/credentials/SignInsSection.tsx",
    "features/issue-page/IssuePagePreference.tsx",
  ],
};
