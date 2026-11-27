import { CreateIssueDialog as UpstreamCreateIssueDialog } from "@upstream-dispatch/features/issue/CreateIssueDialog";

import { upstreamView } from "@/upstream/mark";

export const CreateIssueDialog = upstreamView(UpstreamCreateIssueDialog);
