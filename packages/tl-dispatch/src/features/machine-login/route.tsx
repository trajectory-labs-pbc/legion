import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
// Drawn at first paint before the features move.
import { MachineLoginRoute } from "@/pages/machine-login/machine-login-route";
import type { AppPage } from "@/shell/page-layout";

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
