import { IssuePage as UpstreamIssuePage } from "@upstream-dispatch/features/issue-page/IssuePage";

import { upstreamView } from "@/upstream/mark";

export const IssuePage = upstreamView(UpstreamIssuePage);
