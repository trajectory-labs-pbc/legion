import { LiveViewRoute } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import { AGENT_ARTIFACT_PATH, AGENT_LIVE_PATH } from "@upstream-dispatch/features/refs/routes";
import { lazy } from "react";

import type { Page } from "./page";

const AgentsPage = lazy(() =>
  import("@upstream-dispatch/features/agents/AgentsPage").then((module) => ({
    default: module.AgentsPage,
  }))
);
const BroadcastsPage = lazy(() =>
  import("@upstream-dispatch/features/agents/BroadcastsPage").then((module) => ({
    default: module.BroadcastsPage,
  }))
);
const BroadcastPage = lazy(() =>
  import("@upstream-dispatch/features/agents/BroadcastPage").then((module) => ({
    default: module.BroadcastPage,
  }))
);
const AgentArtifactPage = lazy(() =>
  import("@upstream-dispatch/features/artifacts/AgentArtifactPage").then((module) => ({
    default: module.AgentArtifactPage,
  }))
);

export const agents: Page = {
  id: "agents",
  server: "upstream",
  routes: [
    { path: "/agents", element: <AgentsPage /> },
    { path: "/agents/broadcasts", element: <BroadcastsPage /> },
    { path: "/agents/broadcasts/:id", element: <BroadcastPage /> },
    // Draws nothing: the shell mounts live views outside the routes.
    { path: AGENT_LIVE_PATH, element: <LiveViewRoute /> },
    { path: AGENT_ARTIFACT_PATH, element: <AgentArtifactPage /> },
  ],
  views: ["features/agents/**"],
};
