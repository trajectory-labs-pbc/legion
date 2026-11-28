import { RefPreviewHost as UpstreamRefPreviewHost } from "@upstream-dispatch/features/refs/RefPreview";

import { upstreamView } from "@/upstream/mark";

export const RefPreviewHost = upstreamView(UpstreamRefPreviewHost);
