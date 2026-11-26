// The deployed mode, against a Dispatch this run did not start: modes.ts holds its rules.
// `bun run test:browser:deployed`.
import { defineConfig } from "@playwright/test";

import { commonConfig, commonUse } from "./config";
import { deployedSettings, PHASES } from "./modes";

const { baseURL, phase, storageState } = deployedSettings();

export default defineConfig({
  ...commonConfig,
  ...PHASES[phase],
  reporter: "list",
  use: { ...commonUse, baseURL, storageState },
});
