// What the two configs share: one Chromium project over the `*.e2e.ts` files of this folder, with
// upstream's timeouts. Each config picks which of them run (`localFiles` and `PHASES` in
// modes.ts).
import { devices, type PlaywrightTestConfig } from "@playwright/test";

import { expectTimeout } from "../../dispatch/e2e/expect-timeout";
import { nameRun } from "./modes";

nameRun();

export const commonConfig = {
  testDir: ".",
  testMatch: /\.e2e\.ts$/,
  outputDir: "test-results",
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: expectTimeout },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
} satisfies PlaywrightTestConfig;

export const commonUse = {
  actionTimeout: 45_000,
  headless: true,
  trace: "retain-on-first-failure",
} satisfies PlaywrightTestConfig["use"];
