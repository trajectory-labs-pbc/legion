import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { LiveViewRoute } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import {
  AGENT_ARTIFACT_PATH,
  AGENT_LIVE_PATH,
  liveViewSessionOf,
} from "@upstream-dispatch/features/refs/routes";

import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const AgentsPage = lazyNamed(
  () => import("@upstream-dispatch/features/agents/AgentsPage"),
  "AgentsPage"
);
const BroadcastsPage = lazyNamed(
  () => import("@upstream-dispatch/features/agents/BroadcastsPage"),
  "BroadcastsPage"
);
const BroadcastPage = lazyNamed(
  () => import("@upstream-dispatch/features/agents/BroadcastPage"),
  "BroadcastPage"
);
const AgentArtifactPage = lazyNamed(
  () => import("@upstream-dispatch/features/artifacts/AgentArtifactPage"),
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
    live: pageRoute({
      path: AGENT_LIVE_PATH,
      element: <LiveViewRoute />,
      // The thread scrolls while the header and composer stay put.
      layout: ({ pathname }) => ({ fillsViewport: true, liveView: liveViewSessionOf(pathname) }),
    }),
    artifact: pageRoute({ path: AGENT_ARTIFACT_PATH, element: <AgentArtifactPage /> }),
  },
  views: ["features/agents/**"],
} satisfies Page;
