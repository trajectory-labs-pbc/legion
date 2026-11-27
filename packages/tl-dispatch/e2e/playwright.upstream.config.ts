// The baseline: upstream-still-works on upstream's own build (`bun run test:browser:upstream`).
// It expects build:contracts, this app's build and upstream's build:web from earlier steps.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import type { App } from "./dists";
import local from "./playwright.config";

export default defineConfig<{ app: App }>({
  ...local,
  testMatch: /reading-aids\/upstream-still-works\.e2e\.ts$/,
  use: { ...local.use, app: "upstream" },
  globalSetup: fileURLToPath(new URL("./upstream-server.ts", import.meta.url)),
});
