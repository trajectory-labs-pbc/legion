import { pageRoute } from "@/navigation/page-route";
import { INBOX_LAYOUT, InboxPage } from "./inbox";

import type { Page } from "./page";

export const credentials = {
  id: "credentials",
  server: "upstream",
  routes: {
    // A credential request opens over the Inbox.
    request: pageRoute({ path: "/credentials/*", element: <InboxPage />, layout: INBOX_LAYOUT }),
  },
  // The machine login page (machine-login.tsx) names its own files.
  views: ["features/credentials/**"],
} satisfies Page;
