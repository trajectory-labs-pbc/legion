import { MountedLiveViews as UpstreamMountedLiveViews } from "@upstream-dispatch/features/agent-view/MountedLiveViews";

import { upstreamView } from "@/upstream/mark";

export { LiveViewRoute } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
export const MountedLiveViews = upstreamView(UpstreamMountedLiveViews);
