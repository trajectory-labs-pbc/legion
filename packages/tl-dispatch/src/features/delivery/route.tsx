import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const DeliveryPage = lazyNamed(() => import("@/upstream/views/delivery/delivery"), "DeliveryPage");
const PipelinePage = lazyNamed(() => import("@/upstream/views/delivery/pipeline"), "PipelinePage");

export const delivery = {
  id: "delivery",
  server: "upstream",
  routes: {
    delivery: pageRoute({ ...routes.delivery.delivery, element: <DeliveryPage /> }),
    pipeline: pageRoute({ ...routes.delivery.pipeline, element: <PipelinePage /> }),
  },
  views: ["features/delivery/**"],
} satisfies AppPage<typeof routes.delivery>;
