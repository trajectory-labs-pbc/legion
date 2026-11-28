// What the fork's frame takes from upstream's shell; a component that draws DOM in place is marked.
import { DeploymentResilience as UpstreamDeploymentResilience } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { ErrorBoundary as UpstreamErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";

import { upstreamView } from "@/upstream/mark";

export const DeploymentResilience = upstreamView(UpstreamDeploymentResilience);
export const ErrorBoundary = upstreamView(UpstreamErrorBoundary);

// Draws only portals, into a root that upstream's markdown clears.
export { TextAskBlockCard } from "@upstream-dispatch/features/doc/AskBlockCard";
export { ISSUE_TAB_LABELS } from "@upstream-dispatch/features/issue/issue-tab-list";
export { useIssuePageChoice } from "@upstream-dispatch/features/issue-page/choice";
export {
  type FocusFallback,
  useFocusKeeper,
} from "@upstream-dispatch/features/issue-page/focus-keeper";
export {
  type MarginDrawer,
  type MarginDrawerPage,
  type MarginFill,
  MarginSlotProvider,
  useFillMarginSlot,
  useMarginDrawer,
  useMarginDrawsSlot,
  useMarginSlotFill,
} from "@upstream-dispatch/features/issue-page/margin-slot";
export {
  type ShellNavigation,
  ShellNavigationContext,
  useShellNavigation,
} from "@upstream-dispatch/features/issue-page/shell-navigation";
export {
  ShortcutHelpOpener,
  useShortcutHelpOpener,
} from "@upstream-dispatch/features/issue-page/shortcut-help-opener";
export { firstUsable } from "@upstream-dispatch/features/issue-page/usable-control";
export { MarginProvider, useMargin } from "@upstream-dispatch/features/margin/margin-context";
export { DEFAULT_MARGIN_WIDTH } from "@upstream-dispatch/features/margin/margin-width";
// Draws nothing: it polls the registry of agents.
export {
  AgentRegistryPoller,
  useRegistryPolling,
} from "@upstream-dispatch/features/refs/agent-registry";
export { TextAskCard } from "@upstream-dispatch/features/refs/markdown-cards";
export { NO_HOVER_PREVIEW_ATTRIBUTE } from "@upstream-dispatch/features/refs/ref-preview-card";
export {
  NOTHING_PUBLISHED,
  type PublishedReferences,
  ReferenceNamesProvider,
  useKnownReferences,
  usePublishReferenceNames,
} from "@upstream-dispatch/features/refs/reference-names";
export {
  importWhenOnline,
  installChunkFailureRecovery,
} from "@upstream-dispatch/features/shell/DeploymentResilience";
// The whole signed-in app is its child; its chord indicator is the one element it draws.
export { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
export {
  COMPACT_VIEWPORT_QUERY,
  MD_VIEWPORT_QUERY,
  READING_PANE_QUERY,
  useMediaQuery,
} from "@upstream-dispatch/features/shell/useDialog";
export { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
export { useKeyboardFit } from "@upstream-dispatch/features/shell/useKeyboardFit";
export { DOCUMENT_SCROLL_ATTRIBUTE, useFootInset } from "@upstream-dispatch/hooks/useFootInset";
