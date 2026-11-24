import { lazy } from "react";

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

export const machines: Page = {
  id: "machines",
  server: "upstream",
  routes: [
    { path: "/machines", element: <MachinesPage /> },
    { path: "/machines/:machine", element: <MachinePage /> },
  ],
  views: ["features/machines/**"],
};
