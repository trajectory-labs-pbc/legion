// The local mode's server: upstream's harness (packages/dispatch/e2e/global-setup.ts), which starts
// a Go server, a Postgres and the fakes for each Playwright worker and empties the database before
// each test. It serves the build this file names.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FullConfig } from "@playwright/test";

import upstreamSetup from "../../dispatch/e2e/global-setup";
import { harnessProcessCount } from "../../dispatch/e2e/harness-processes";
import { type App, WEB_DISTS } from "./dists";

/** The command that builds each app's dist. */
const BUILD: Readonly<Record<App, string>> = {
  "tl-dispatch": "`vite build` in packages/tl-dispatch",
  upstream: "`bun run build:web` in packages/dispatch",
};

/** `app`'s build, which must exist. */
function builtDist(app: App): string {
  const dist = WEB_DISTS[app];
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`${dist} holds no index.html: build ${app} first (${BUILD[app]}).`);
  }
  return dist;
}

/** Points the servers this process starts at `app`'s build. run-server.sh hands it to the server
 *  as DISPATCH_WEB_DIST. */
export function serveDist(app: App): void {
  process.env.DISPATCH_E2E_SERVER_WEB_DIST = builtDist(app);
}

/** A global setup that starts upstream's harness with its server on `app`'s build; in two-process
 *  mode that is Dispatch A, and Dispatch B serves upstream's build (playwright.config.ts). */
export function serving(app: App): (config: FullConfig) => Promise<void> {
  return async (config) => {
    serveDist(app);
    if (harnessProcessCount === 2) builtDist("upstream");
    await upstreamSetup(config);
  };
}

export default serving("tl-dispatch");
