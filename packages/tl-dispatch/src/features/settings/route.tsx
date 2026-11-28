import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const SettingsPage = lazyNamed(() => import("@/upstream/views/settings"), "SettingsPage");

export const settings = {
  id: "settings",
  server: "upstream",
  routes: {
    settings: pageRoute({ ...routes.settings.settings, element: <SettingsPage /> }),
  },
  views: [
    "features/settings/**",
    // Files of other folders only Settings renders.
    "features/credentials/GrantsSection.tsx",
    "features/credentials/SignInsSection.tsx",
    "features/issue-page/IssuePagePreference.tsx",
  ],
} satisfies AppPage<typeof routes.settings>;
