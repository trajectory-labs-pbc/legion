import { InboxDrawer as UpstreamInboxDrawer } from "@upstream-dispatch/features/inbox/InboxDrawer";

import { upstreamView } from "@/upstream/mark";

export const InboxDrawer = upstreamView(UpstreamInboxDrawer);
