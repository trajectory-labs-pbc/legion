import { MachineLoginRoute } from "@upstream-dispatch/features/credentials/MachineLoginRoute";

import { InboxPage } from "./inbox";
import type { Page } from "./page";

export const credentials: Page = {
  id: "credentials",
  server: "upstream",
  routes: [
    // A credential request opens over the Inbox.
    { path: "/credentials/*", element: <InboxPage /> },
    { path: "/credentials/machine", element: <MachineLoginRoute /> },
  ],
  views: ["features/credentials/**"],
};
