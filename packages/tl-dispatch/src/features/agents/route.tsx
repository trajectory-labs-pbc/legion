import { prefetchOf } from "@/data/prefetch";
import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";
import { userAgentStateQuery } from "@/upstream/queries";
import { LiveViewRoute } from "@/upstream/widgets/live-views";

const AgentsPage = lazyNamed(() => import("@/upstream/views/agents/agents"), "AgentsPage");
const BroadcastsPage = lazyNamed(
  () => import("@/upstream/views/agents/broadcasts"),
  "BroadcastsPage"
);
const BroadcastPage = lazyNamed(() => import("@/upstream/views/agents/broadcast"), "BroadcastPage");
const AgentArtifactPage = lazyNamed(
  () => import("@/upstream/views/agents/artifact"),
  "AgentArtifactPage"
);

export const agents = {
  id: "agents",
  server: "upstream",
  routes: {
    list: pageRoute({
      ...routes.agents.list,
      element: <AgentsPage />,
      prefetch: () => [prefetchOf(userAgentStateQuery())],
    }),
    broadcasts: pageRoute({ ...routes.agents.broadcasts, element: <BroadcastsPage /> }),
    broadcast: pageRoute({ ...routes.agents.broadcast, element: <BroadcastPage /> }),
    // Draws nothing: the shell mounts live views outside the routes.
    live: pageRoute({ ...routes.agents.live, element: <LiveViewRoute /> }),
    artifact: pageRoute({ ...routes.agents.artifact, element: <AgentArtifactPage /> }),
  },
  views: ["features/agents/**"],
} satisfies AppPage<typeof routes.agents>;
