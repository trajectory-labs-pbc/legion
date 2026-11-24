import { MachineLoginRoute } from "@upstream-dispatch/features/credentials/MachineLoginRoute";
import { pageRoute } from "@/navigation/page-route";
import { InboxPage } from "./inbox";

import type { Page } from "./page";

export const credentials = {
  id: "credentials",
  server: "upstream",
  routes: {
    // A credential request opens over the Inbox.
    request: pageRoute({ path: "/credentials/*", element: <InboxPage /> }),
    machine: pageRoute({ path: "/credentials/machine", element: <MachineLoginRoute /> }),
  },
  views: ["features/credentials/**"],
} satisfies Page;
