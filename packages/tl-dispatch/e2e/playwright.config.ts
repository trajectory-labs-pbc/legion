// The local mode: upstream's harness starts a Dispatch on this app's build (server.ts), and each
// test starts from an emptied database. `bun run test:browser`; CI runs it.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

import { baseUrl } from "../../dispatch/e2e/api";
import { commonConfig, commonUse } from "./config";
import { localSettings } from "./modes";

localSettings();

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  ...commonConfig,
  // The workers read the harness's port after the setup, when they evaluate this file again.
  use: { ...commonUse, baseURL: baseUrl },
  // Upstream's teardown keeps the stack's logs unless its failure reporter saw the run pass.
  reporter: [["list"], [here("../../dispatch/e2e/failure-reporter.ts")]],
  globalSetup: here("./server.ts"),
  globalTeardown: here("../../dispatch/e2e/global-teardown.ts"),
});
