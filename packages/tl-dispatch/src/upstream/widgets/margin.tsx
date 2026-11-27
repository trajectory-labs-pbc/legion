// Upstream's margin, for tests to wait on the chunk the margin column loads.
import { Margin as UpstreamMargin } from "@upstream-dispatch/features/margin/Margin";

import { upstreamView } from "@/upstream/mark";

export const Margin = upstreamView(UpstreamMargin);
