import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";
// Upstream draws it at first paint, so it loads with the entry (tests/layers.table.ts, EAGER).
import { MachineLoginRoute } from "./page";

export const machineLogin = {
  id: "machine-login",
  server: "fork",
  routes: {
    machine: pageRoute({ ...routes["machine-login"].machine, element: <MachineLoginRoute /> }),
  },
  // RevocableList.tsx also draws two upstream Settings sections (src/views.ts).
  views: [
    "features/credentials/CredentialDecisionButtons.tsx",
    "features/credentials/CredentialRecordFacts.tsx",
    "features/credentials/MachineLoginPage.tsx",
    "features/credentials/MachineLoginRoute.tsx",
    "features/credentials/MachineLoginsSection.tsx",
  ],
} satisfies AppPage<(typeof routes)["machine-login"]>;
