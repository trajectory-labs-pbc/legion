import { AgentName as UpstreamAgentName } from "@upstream-dispatch/features/refs/AgentName";

import { upstreamView } from "@/upstream/mark";

export const AgentName = upstreamView(UpstreamAgentName);
