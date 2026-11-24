import { lazy } from "react";

import type { Page } from "./page";

const DeliveryPage = lazy(() =>
  import("@upstream-dispatch/features/delivery/DeliveryPage").then((module) => ({
    default: module.DeliveryPage,
  }))
);
const PipelinePage = lazy(() =>
  import("@upstream-dispatch/features/delivery/PipelinePage").then((module) => ({
    default: module.PipelinePage,
  }))
);

export const delivery: Page = {
  id: "delivery",
  server: "upstream",
  routes: [
    { path: "/delivery", element: <DeliveryPage /> },
    { path: "/pipeline", element: <PipelinePage /> },
  ],
  views: ["features/delivery/**"],
};
