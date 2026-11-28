import { PersonPage as UpstreamPersonPage } from "@upstream-dispatch/features/people/PersonPage";

import { upstreamView } from "@/upstream/mark";

export const PersonPage = upstreamView(UpstreamPersonPage);
