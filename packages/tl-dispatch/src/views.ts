/**
 * Upstream view files that no page owns, as paths or globs under upstream's `web/src`. With each
 * page file's `views`, they give every view file under `features/` exactly one owner. An exact
 * path wins over a glob, so a file another owner renders can leave its folder's owner.
 */

/** The shell's views: the frame every page renders in. */
export const shellViews: readonly string[] = [
  "features/shell/**",
  "features/search/**",
  "features/sidebar/**",
  "features/writes/**",
  // Files of page folders only the shell renders.
  "features/inbox/DraftsNotKept.tsx",
  "features/inbox/InboxDrawer.tsx",
  "features/issue-page/IconRail.tsx",
  "features/issue/CreateIssueDialog.tsx",
  "features/issue/RelatedItems.tsx",
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

/**
 * Views more than one owner renders. A change to one is ported to every rebuilt page, shell or
 * widget that loads it, which the import graph names. Only the files two owners load directly are
 * listed: a page's file that only its page and shared files load is shared too
 * (tests/map/coverage.ts, effectiveOwners).
 */
export const sharedViews: Readonly<Record<string, readonly string[]>> = {
  // Reference links, previews, Markdown bodies and timestamps: drawn on nearly every page.
  refs: ["features/refs/**"],
  pages: [
    "features/architecture/ComponentPicker.tsx",
    "features/credentials/RevocableList.tsx",
    "features/delivery/DeliverySettingsForm.tsx",
    "features/inbox/BlockedOnYou.tsx",
    "features/inbox/Inbox.tsx",
    "features/issue-page/margin-slot.tsx",
    "features/issue-page/reference-names.tsx",
    "features/issue-page/shell-navigation.tsx",
    "features/issue-page/shortcut-help-opener.tsx",
    "features/issue/ClaimChip.tsx",
    "features/issue/GitHubLink.tsx",
    "features/issue/PriorityControl.tsx",
    "features/issue/ProgressChips.tsx",
    "features/issue/RouteReach.tsx",
    "features/issue/SubscribedAgents.tsx",
    "features/project/IssuesTable.tsx",
    "features/project/issues-table-controls.tsx",
  ],
};
