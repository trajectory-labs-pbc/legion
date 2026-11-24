import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import {
  type GeneratedCode,
  packageRoot,
  thirdPartyNotices,
  viteBundleInputs,
  viteRuntimeGeneratedCode,
} from "../../scripts/third-party-notices";
import { oneCopyEach } from "./scripts/one-copy-each";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// micromark's DOM-free decoder: the `browser` build calls `document`, which a worker lacks.
const proofEditor = createRequire(at("../proof-editor/src/lib-headless.ts"));
const characterReferenceDecoder = createRequire(
  proofEditor.resolve("micromark-core-commonmark")
).resolve("decode-named-character-reference");
const vite = packageRoot("vite", at("."));
const GENERATED_CODE: GeneratedCode[] = [
  viteRuntimeGeneratedCode(vite),
  { id: /^\0(commonjsHelpers\.js|commonjs-dynamic-modules)$/, packages: [vite] },
  { id: /^\0\/.*\?commonjs-(module|exports)$/, packages: [] },
];

// Writes dist/THIRD_PARTY_NOTICES.txt for the page bundle and each worker bundle.
function thirdPartyNoticesFile(): { page: Plugin; worker: () => Plugin } {
  let root = "";
  const workerFiles = new Set<string>();
  const workerInputs = new Set<string>();
  return {
    page: {
      name: "third-party-notices",
      apply: "build",
      configResolved(config) {
        root = config.root;
      },
      async generateBundle(_options, bundle) {
        const pageBundle = Object.fromEntries(
          Object.entries(bundle).filter(([fileName]) => !workerFiles.has(fileName))
        );
        const inputs = await viteBundleInputs(this, pageBundle, root, GENERATED_CODE);
        for (const input of workerInputs) inputs.add(input);
        this.emitFile({
          type: "asset",
          fileName: "THIRD_PARTY_NOTICES.txt",
          source: await thirdPartyNotices(inputs, root),
        });
      },
    },
    worker: () => ({
      name: "third-party-notices-worker",
      apply: "build",
      async generateBundle(_options, bundle) {
        for (const fileName of Object.keys(bundle)) workerFiles.add(fileName);
        for (const input of await viteBundleInputs(this, bundle, root, GENERATED_CODE)) {
          workerInputs.add(input);
        }
      },
    }),
  };
}

const notices = thirdPartyNoticesFile();

// The libraries both apps' code reaches come from the root install (scripts/link-root-packages.ts).
const { rootPackages } = JSON.parse(readFileSync(at("package.json"), "utf8")) as {
  rootPackages: string[];
};

export default defineConfig({
  root: at("."),
  publicDir: at("../dispatch/web/public"),
  plugins: [
    react(),
    tailwindcss(),
    notices.page,
    oneCopyEach(rootPackages, `${at("node_modules")}/`),
  ],
  worker: { format: "es", plugins: () => [notices.worker()] },
  define: {
    __DISPATCH_BUILD__: JSON.stringify(
      process.env.DISPATCH_BUILD ?? process.env.GITHUB_SHA ?? Date.now().toString()
    ),
  },
  resolve: {
    // One copy of each library both apps' code reaches.
    dedupe: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "yjs",
      "prosemirror-model",
    ],
    alias: {
      "@upstream-dispatch": at("../dispatch/web/src"),
      "decode-named-character-reference": characterReferenceDecoder,
      "@legion/contracts/repo": at("../contracts/src/repo.ts"),
      "@legion/contracts/dispatch-snippet": at("../contracts/src/dispatch-snippet.ts"),
      "@legion/contracts/dispatch-tools": at("../contracts/src/dispatch-tools.ts"),
      "@legion/contracts": at("../contracts/src/index.ts"),
      "@legion/proof-editor/document-json": at("../proof-editor/src/document-json.ts"),
      "@legion/proof-editor/headless": at("../proof-editor/src/lib-headless.ts"),
      "@legion/proof-editor/mermaid": at("../proof-editor/src/mermaid-svg.ts"),
      "@legion/proof-editor/mermaid-render": at("../proof-editor/src/mermaid-render.ts"),
      "@legion/proof-editor/style.css": at("../proof-editor/src/lib.css"),
      "@legion/proof-editor/block-nesting": at("../proof-editor/src/block-nesting.ts"),
      "@legion/proof-editor": at("../proof-editor/src/lib.ts"),
      "proof-sdk-upstream/src": at("../proof-editor/node_modules/proof-sdk-upstream/src"),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8766",
      "/auth": "http://localhost:8766",
      "/ws": { target: "ws://localhost:8766", ws: true },
    },
  },
});
