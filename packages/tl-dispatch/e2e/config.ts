// What the two configs share: one Chromium project over every `*.e2e.ts` of this folder but the
// multiprocess ones, with upstream's timeouts.
import { devices, type PlaywrightTestConfig } from "@playwright/test";

import { expectTimeout } from "../../dispatch/e2e/expect-timeout";
import { nameRun } from "./modes";

nameRun();

export const commonConfig = {
  testDir: ".",
  testMatch: /\.e2e\.ts$/,
  // As upstream's default run: a multiprocess spec needs two servers and runs on its own. No such
  // file is here yet; the switch test will be one, and the routes-and-flows phase leaves it out.
  testIgnore: /\.multiprocess\.e2e\.ts$/,
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
