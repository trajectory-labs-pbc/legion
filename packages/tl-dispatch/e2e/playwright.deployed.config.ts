// The deployed mode, against a Dispatch this run did not start: modes.ts holds its rules.
// `bun run test:browser:deployed`.
import { defineConfig } from "@playwright/test";

import { commonConfig, commonUse } from "./config";
import { deployedSettings, PHASES, storageCookies } from "./modes";

const { baseURL, phase, storageState } = deployedSettings();

export default defineConfig({
  ...commonConfig,
  ...PHASES[phase],
  reporter: "list",
  // A retry would seed the run's records again under the same name, which the server refuses.
  retries: 0,
  use: {
    ...commonUse,
    baseURL,
    storageState: { cookies: storageCookies(storageState), origins: [] },
    // No trace: a trace would hold the person's session cookie.
    trace: "off",
  },
});
