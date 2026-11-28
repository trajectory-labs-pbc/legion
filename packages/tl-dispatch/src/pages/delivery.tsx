import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const DeliveryPage = lazyNamed(() => import("@/upstream/views/delivery/delivery"), "DeliveryPage");
const PipelinePage = lazyNamed(() => import("@/upstream/views/delivery/pipeline"), "PipelinePage");

export const delivery = {
  id: "delivery",
  server: "upstream",
  routes: {
    delivery: pageRoute({ path: "/delivery", element: <DeliveryPage /> }),
    pipeline: pageRoute({ path: "/pipeline", element: <PipelinePage /> }),
  },
  views: ["features/delivery/**"],
} satisfies Page;
