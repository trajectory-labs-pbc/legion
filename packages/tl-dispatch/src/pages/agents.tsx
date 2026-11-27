import { prefetchOf } from "@/data/prefetch";
import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { userAgentStateQuery } from "@/upstream/queries";
import { AGENT_ARTIFACT_PATH, AGENT_LIVE_PATH } from "@/upstream/routes";
import { LiveViewRoute } from "@/upstream/widgets/live-views";

import type { Page } from "./page";

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
      path: "/agents",
      element: <AgentsPage />,
      prefetch: () => [prefetchOf(userAgentStateQuery())],
    }),
    broadcasts: pageRoute({ path: "/agents/broadcasts", element: <BroadcastsPage /> }),
    broadcast: pageRoute({ path: "/agents/broadcasts/:id", element: <BroadcastPage /> }),
    // Draws nothing: the shell mounts live views outside the routes.
    live: pageRoute({ path: AGENT_LIVE_PATH, element: <LiveViewRoute /> }),
    artifact: pageRoute({ path: AGENT_ARTIFACT_PATH, element: <AgentArtifactPage /> }),
  },
  views: ["features/agents/**"],
} satisfies Page;
