/**
 * Upstream view files that no page owns, as globs under upstream's `web/src`. With each page
 * file's `views`, they give every view file under `features/` exactly one owner.
 */

/** The shell's views: the frame every page renders in. */
export const shellViews: readonly string[] = [
  "features/shell/**",
  "features/search/**",
  "features/sidebar/**",
  "features/writes/**",
];

/** Upstream files outside `features/` that the shell copies from. */
export const shellFiles: readonly string[] = [
  "packages/dispatch/web/src/app.tsx",
  "packages/dispatch/web/src/main.tsx",
  "packages/dispatch/web/index.html",
  "packages/dispatch/web/vite.config.ts",
  "packages/dispatch/web/src/features/refs/routes.ts",
];

/** Widgets several pages mount; they stay upstream's until the issue page is rebuilt. */
export const widgetViews: Readonly<Record<string, readonly string[]>> = {
  activity: ["features/activity/**"],
  "agent-view": ["features/agent-view/**"],
  artifacts: ["features/artifacts/**"],
  conversation: ["features/conversation/**"],
  doc: ["features/doc/**"],
  margin: ["features/margin/**"],
};
