import { Timestamp as UpstreamTimestamp } from "@upstream-dispatch/features/refs/Timestamp";

import { upstreamView } from "@/upstream/mark";

export const Timestamp = upstreamView(UpstreamTimestamp);
