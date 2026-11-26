// The local mode's server: upstream's harness (packages/dispatch/e2e/global-setup.ts), which starts
// a Go server, a Postgres and the fakes for each Playwright worker and empties the database before
// each test. It serves the build this file names.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FullConfig } from "@playwright/test";

import upstreamSetup from "../../dispatch/e2e/global-setup";
import { type App, WEB_DISTS } from "./dists";

/** Points the servers this process starts at `app`'s build, which must exist. */
export function serveDist(app: App): void {
  const dist = WEB_DISTS[app];
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`${dist} holds no index.html: build ${app} first.`);
  }
  // run-server.sh hands it to the server as DISPATCH_WEB_DIST.
  process.env.DISPATCH_E2E_SERVER_WEB_DIST = dist;
}

/** A global setup that starts upstream's harness with its server on `app`'s build. */
export function serving(app: App): (config: FullConfig) => Promise<void> {
  return async (config) => {
    serveDist(app);
    await upstreamSetup(config);
  };
}

export default serving("tl-dispatch");
