import { lazy } from "react";

import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const MachinesPage = lazy(() =>
  import("@upstream-dispatch/features/machines/MachinesPage").then((module) => ({
    default: module.MachinesPage,
  }))
);
const MachinePage = lazy(() =>
  import("@upstream-dispatch/features/machines/MachinePage").then((module) => ({
    default: module.MachinePage,
  }))
);

export const machines = {
  id: "machines",
  server: "upstream",
  routes: {
    list: pageRoute({ path: "/machines", element: <MachinesPage /> }),
    machine: pageRoute({ path: "/machines/:machine", element: <MachinePage /> }),
  },
  views: ["features/machines/**"],
} satisfies Page;
