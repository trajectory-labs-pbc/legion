import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const MachinesPage = lazyNamed(() => import("@/upstream/views/machines/machines"), "MachinesPage");
const MachinePage = lazyNamed(() => import("@/upstream/views/machines/machine"), "MachinePage");

export const machines = {
  id: "machines",
  server: "upstream",
  routes: {
    list: pageRoute({ path: "/machines", element: <MachinesPage /> }),
    machine: pageRoute({ path: "/machines/:machine", element: <MachinePage /> }),
  },
  views: ["features/machines/**"],
} satisfies Page;
