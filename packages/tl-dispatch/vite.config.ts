import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mergeConfig, type UserConfig } from "vite";
import upstream from "../dispatch/web/vite.config";
import { oneCopyEach } from "./scripts/one-copy-each";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The libraries both apps' code reaches come from the root install (packages/ui/scripts/link-root-packages.ts).
// packages/ui's components import the UI packages, which this app installs too: the build takes
// this app's copy of each.
const { rootPackages, uiPackages } = JSON.parse(readFileSync(at("package.json"), "utf8")) as {
  rootPackages: string[];
  uiPackages: string[];
};

// Upstream's build (its plugins, notices, define, editor aliases, proxy), with this app's entry,
// its own aliases and one copy of each shared library. An alias list comes before upstream's.
export default mergeConfig(upstream, {
  root: at("."),
  publicDir: at("../dispatch/web/public"),
  plugins: [oneCopyEach({ root: rootPackages, ui: uiPackages }, `${at("node_modules")}/`)],
  resolve: {
    dedupe: [...rootPackages, ...uiPackages],
    alias: [
      { find: "@", replacement: at("./src") },
      { find: "@upstream-dispatch", replacement: at("../dispatch/web/src") },
      { find: "@legion/ui/blocks", replacement: at("../ui/src/blocks") },
      { find: "@legion/ui/components", replacement: at("../ui/src/components") },
      { find: "@legion/ui/lib", replacement: at("../ui/src/lib") },
    ],
  },
} satisfies UserConfig);
