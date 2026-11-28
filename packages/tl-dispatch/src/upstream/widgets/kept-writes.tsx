import { KeptWrites as UpstreamKeptWrites } from "@upstream-dispatch/features/writes/KeptWrites";

import { upstreamView } from "@/upstream/mark";

export const KeptWrites = upstreamView(UpstreamKeptWrites);
