import { DraftsNotKept as UpstreamDraftsNotKept } from "@upstream-dispatch/features/inbox/DraftsNotKept";
import { PendingWritesIndicator as UpstreamPendingWritesIndicator } from "@upstream-dispatch/features/writes/PendingWritesIndicator";

import { upstreamView } from "@/upstream/mark";

export const PendingWritesIndicator = upstreamView(UpstreamPendingWritesIndicator);
export const DraftsNotKept = upstreamView(UpstreamDraftsNotKept);
