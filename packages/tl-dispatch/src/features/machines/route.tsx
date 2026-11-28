import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const MachinesPage = lazyNamed(() => import("@/upstream/views/machines/machines"), "MachinesPage");
const MachinePage = lazyNamed(() => import("@/upstream/views/machines/machine"), "MachinePage");

export const machines = {
  id: "machines",
  server: "upstream",
  routes: {
    list: pageRoute({ ...routes.machines.list, element: <MachinesPage /> }),
    machine: pageRoute({ ...routes.machines.machine, element: <MachinePage /> }),
  },
  views: ["features/machines/**"],
} satisfies AppPage<typeof routes.machines>;
