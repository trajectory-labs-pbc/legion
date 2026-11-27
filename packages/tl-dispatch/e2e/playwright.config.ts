// The local mode: upstream's harness starts a Dispatch on this app's build (server.ts), and each
// test starts from an emptied database. `bun run test:browser`; CI runs it.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

import { baseUrl } from "../../dispatch/e2e/api";
import { harnessProcessCount } from "../../dispatch/e2e/harness-processes";
import { commonConfig, commonUse } from "./config";
import { WEB_DISTS } from "./dists";
import { localFiles, localSettings } from "./modes";

localSettings();
// In two-process mode Dispatch B serves upstream's build. The harness reads this when the global
// setup loads it, after this file.
if (harnessProcessCount === 2) process.env.DISPATCH_E2E_WEB_DIST_B = WEB_DISTS.upstream;

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  ...commonConfig,
  ...localFiles(harnessProcessCount),
  // The workers read the harness's port after the setup, when they evaluate this file again.
  use: { ...commonUse, baseURL: baseUrl },
  // Upstream's teardown keeps the stack's logs unless its failure reporter saw the run pass.
  reporter: [["list"], [here("../../dispatch/e2e/failure-reporter.ts")]],
  globalSetup: here("./server.ts"),
  globalTeardown: here("../../dispatch/e2e/global-teardown.ts"),
});
