// The builds the local server can serve, apart from server.ts so that a test reads them without
// loading upstream's global setup.
import { fileURLToPath } from "node:url";

import { webDistOf } from "../../dispatch/e2e/harness-processes";

/** This app's build, and upstream's for a test that switches apps. */
export const WEB_DISTS = {
  "tl-dispatch": fileURLToPath(new URL("../dist", import.meta.url)),
  upstream: webDistOf("a"),
} as const;

export type App = keyof typeof WEB_DISTS;
