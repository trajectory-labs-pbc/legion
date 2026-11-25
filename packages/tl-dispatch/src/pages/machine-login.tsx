import { pageRoute } from "@/navigation/page-route";
import { MachineLoginRoute } from "./machine-login/machine-login-route";

import type { Page } from "./page";

export const machineLogin = {
  id: "machine-login",
  server: "fork",
  routes: {
    machine: pageRoute({ path: "/credentials/machine", element: <MachineLoginRoute /> }),
  },
  // RevocableList.tsx also draws two upstream Settings sections (src/views.ts).
  views: [
    "features/credentials/CredentialDecisionButtons.tsx",
    "features/credentials/CredentialRecordFacts.tsx",
    "features/credentials/MachineLoginPage.tsx",
    "features/credentials/MachineLoginRoute.tsx",
    "features/credentials/MachineLoginsSection.tsx",
  ],
} satisfies Page;
