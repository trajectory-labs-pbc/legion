import { lazy } from "react";

import { pageRoute } from "@/navigation/page-route";

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

export const delivery = {
  id: "delivery",
  server: "upstream",
  routes: {
    delivery: pageRoute({ path: "/delivery", element: <DeliveryPage /> }),
    pipeline: pageRoute({ path: "/pipeline", element: <PipelinePage /> }),
  },
  views: ["features/delivery/**"],
} satisfies Page;
