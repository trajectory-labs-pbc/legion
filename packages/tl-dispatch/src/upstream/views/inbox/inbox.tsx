import { Inbox as UpstreamInbox } from "@upstream-dispatch/features/inbox/Inbox";

import { upstreamView } from "@/upstream/mark";

export const Inbox = upstreamView(UpstreamInbox);
