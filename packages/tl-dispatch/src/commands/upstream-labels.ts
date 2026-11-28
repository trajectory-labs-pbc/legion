import type { KeymapScope } from "@/upstream/keys";

/** Our labels for upstream's bindings, by `scope:id`, where theirs do not fit the sheet. */
export type UpstreamLabels = Readonly<
  Partial<Record<`${KeymapScope}:${string}`, { upstream: string; label: string }>>
>;

/**
 * The sheet's labels for upstream's bindings whose own do not fit it (a verb and its object, four
 * words at most), by `scope:id`, each beside upstream's label as its source writes it, so a test
 * notices when upstream's changes.
 */
export const UPSTREAM_LABELS: UpstreamLabels = {
  "agents:back": {
    upstream: "Close the issue picker, or go back to the agent row",
    label: "Go back",
  },
  "agents:issue-picker": { upstream: "Pick an issue for the message", label: "Pick an issue" },
  "agents:pin": { upstream: "Pin or unpin the focused agent", label: "Pin or unpin agent" },
  "agents:select": { upstream: "Select or deselect the focused agent", label: "Toggle selection" },
  "architecture:arrows": {
    upstream: "Next / previous component while one is focused",
    label: "Next / previous component",
  },
  "architecture:back": { upstream: "Back to the component row, then out", label: "Go back" },
  "architecture:descend": {
    upstream: "Into the focused component's children",
    label: "Open component children",
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
  "board:back": { upstream: "Back to the card, then out", label: "Go back" },
  "board:copy-key": { upstream: "Copy the card's issue key", label: "Copy issue key" },
  "board:copy-ref": { upstream: "Copy the card's issue reference", label: "Copy issue reference" },
  "board:move-next": { upstream: "Move card to the next status", label: "Move card forward" },
  "board:move-previous": { upstream: "Move card to the previous status", label: "Move card back" },
  "board:open-enter": { upstream: "Open the focused card's issue", label: "Open issue" },
  "inbox:answer": { upstream: "Answer the {acted} ask", label: "Answer ask" },
  "inbox:arrows": {
    upstream: "Next / previous row while {arrowsWhen}",
    label: "Next / previous row",
  },
  "inbox:back": { upstream: "Back to the row, then clear the focused row", label: "Go back" },
  "inbox:back-from-bulk": {
    upstream: "Back to the list from the bulk snooze picker",
    label: "Close snooze picker",
  },
  "inbox:copy-ref": { upstream: "Copy the {acted} row's reference", label: "Copy row reference" },
  "inbox:leave-search": { upstream: "Back to the list from the search box", label: "Leave search" },
  "inbox:open": { upstream: "Open the row's issue, document or thread", label: "Open row" },
  "inbox:option": { upstream: "Select option 1–9 of the {acted} ask", label: "Select an option" },
  "inbox:read-pane": {
    upstream: "Move the focus into the reading pane",
    label: "Focus reading pane",
  },
  "inbox:search": { upstream: "Search asks", label: "Filter this list" },
  "inbox:select": { upstream: "Select or deselect the {acted} row", label: "Toggle selection" },
  "inbox:snooze": {
    upstream: "Snooze the focused ask, or every selected ask",
    label: "Snooze ask or selection",
  },
  "issue:approve": { upstream: "Approve the focused approval request", label: "Approve request" },
  "issue:back": { upstream: "Back out of the focused header control", label: "Go back" },
  "issue:pin": { upstream: "Pin or unpin the issue", label: "Pin or unpin issue" },
  "issue:request-changes": {
    upstream: "Request changes on the focused approval request",
    label: "Request changes",
  },
  "issue:tree-children": { upstream: "Move to the issue's children", label: "Go to children" },
  "issue:tree-cycle": {
    upstream: "Cycle how much of the tree is drawn",
    label: "Cycle tree detail",
  },
  "issue:tree-decision": {
    upstream: "Move into the decision behind the focused row",
    label: "Open row's decision",
  },
  "issue:tree-first": { upstream: "Move to the first row", label: "Go to first row" },
  "issue:tree-fold": {
    upstream: "Fold the focused row, or move to its parent",
    label: "Fold or leave row",
  },
  "issue:tree-last": { upstream: "Move to the last row", label: "Go to last row" },
  "issue:tree-leave": {
    upstream: "Leave the control, then the tree",
    label: "Leave control or tree",
  },
  "issue:tree-next": { upstream: "Move to the next row", label: "Next row" },
  "issue:tree-pin": { upstream: "Keep the focused row's body open", label: "Keep row open" },
  "issue:tree-previous": { upstream: "Move to the previous row", label: "Previous row" },
  "issue:tree-question": {
    upstream: "Move to the next open question",
    label: "Next open question",
  },
  "issue:tree-reply": {
    upstream: "{CONTROL_LABELS.reply} to the focused row",
    label: "Reply to row",
  },
  "issue:tree-unfold": {
    upstream: "Unfold the focused row, or move into it",
    label: "Unfold or enter row",
  },
  "issue:tree-zoom-in": { upstream: "Zoom into the focused row", label: "Zoom into row" },
  "issue:tree-zoom-out": { upstream: "Zoom back out one level", label: "Zoom out" },
  "project:list-open-enter": { upstream: "Open the focused issue", label: "Open issue" },
  "project:list-select": {
    upstream: "Select or deselect the focused issue",
    label: "Toggle selection",
  },
};
