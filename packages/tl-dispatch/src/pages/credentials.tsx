import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { INBOX_LAYOUT, InboxPage } from "./inbox";

import type { Page } from "./page";

const MachineLoginRoute = lazyNamed(
  () => import("@upstream-dispatch/features/credentials/MachineLoginRoute"),
  "MachineLoginRoute"
);

export const credentials = {
  id: "credentials",
  server: "upstream",
  routes: {
    // A credential request opens over the Inbox.
    request: pageRoute({ path: "/credentials/*", element: <InboxPage />, layout: INBOX_LAYOUT }),
    machine: pageRoute({ path: "/credentials/machine", element: <MachineLoginRoute /> }),
  },
  views: ["features/credentials/**"],
} satisfies Page;
