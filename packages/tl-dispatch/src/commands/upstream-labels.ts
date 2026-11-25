import type { KeymapScope } from "@upstream-dispatch/features/shell/keymap";

/** Our labels for upstream's bindings, by `scope:id`, where theirs do not fit the sheet. */
export type UpstreamLabels = Readonly<
  Partial<Record<`${KeymapScope}:${string}`, { upstream: string; label: string }>>
>;

/**
 * The sheet's labels for upstream's bindings whose own do not fit it, by `scope:id`, each beside
 * upstream's label as its source writes it, so a test notices when upstream's changes.
 */
export const UPSTREAM_LABELS: UpstreamLabels = {
  "inbox:arrows": {
    upstream: "Next / previous row while {arrowsWhen}",
    label: "Next / previous row",
  },
  "inbox:option": { upstream: "Select option 1–9 of the {acted} ask", label: "Select an option" },
  "inbox:snooze": {
    upstream: "Snooze the focused ask, or every selected ask",
    label: "Snooze the ask or the selection",
  },
  "architecture:arrows": {
    upstream: "Next / previous component while one is focused",
    label: "Next / previous component",
  },
  "architecture:open": {
    upstream: "Open the focused component: its children, else its details",
    label: "Open the focused component",
  },
  "board:arrows-horizontal": {
    upstream: "Next / previous column while one is focused",
    label: "Next / previous column",
  },
  "board:arrows-vertical": {
    upstream: "Next / previous card while one is focused",
    label: "Next / previous card",
  },
  "issue:request-changes": {
    upstream: "Request changes on the focused approval request",
    label: "Request changes",
  },
  "issue:tree-decision": {
    upstream: "Move into the decision behind the focused row",
    label: "Move into the row's decision",
  },
  "issue:tree-fold": {
    upstream: "Fold the focused row, or move to its parent",
    label: "Fold the row, or go to its parent",
  },
};
