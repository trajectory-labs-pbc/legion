// Upstream's Inbox logic, unchanged. Only src/data/inbox reads it, and no file of the Inbox, the
// parts or the Inbox's data declares one of these names (tests/inbox-copies.test.ts).

export { awaitsDecision } from "@legion/contracts";
export { searchWords } from "@upstream-dispatch/features/agents/agent-search";
export { answerAskInput } from "@upstream-dispatch/features/inbox/answer-ask";
export {
  answerDraft,
  answerDraftsSignedIn,
  answerDraftsSignedOut,
  reloadAnswerDrafts,
  setAnswerDraft,
  useAnswerDraft,
} from "@upstream-dispatch/features/inbox/answer-drafts";
export { askIssueKey } from "@upstream-dispatch/features/inbox/ask-name";
export {
  beginInboxFetch,
  clearPendingAskThreadInvalidation,
  finishInboxFetch,
  hasPendingAskThreadInvalidation,
  markPendingAskThreadInvalidation,
  markPendingAskThreadsOnIssue,
} from "@upstream-dispatch/features/inbox/ask-thread-freshness";
export { askUrgency, URGENCY_LABELS } from "@upstream-dispatch/features/inbox/ask-urgency";
export type {
  DraftStore,
  NotKeptReason,
  StoreName,
} from "@upstream-dispatch/features/inbox/draft-store";
export {
  createDraftStore,
  DRAFT_KEPT_UNITS,
  STORE_KEPT_UNITS,
  useDraftsNotKept,
} from "@upstream-dispatch/features/inbox/draft-store";
export type {
  GroupingContext,
  InboxGroup,
} from "@upstream-dispatch/features/inbox/grouping";
export {
  ALL_GROUP_KEY,
  DEFAULT_FOLDED_GROUPS,
  DIMENSION_LABELS,
  dimensionValue,
  dimensionValueLabel,
  filterCounts,
  group,
  inFieldFilter,
  LATER_GROUP_KEY,
  sortRows,
  TYPE_LABELS,
} from "@upstream-dispatch/features/inbox/grouping";
export { matchesInboxSearch } from "@upstream-dispatch/features/inbox/inbox-search";
export type {
  InboxListRow,
  InboxRowType,
} from "@upstream-dispatch/features/inbox/list-row";
export {
  askProject,
  askWaitingOnPerson,
  INBOX_ROW_TYPES,
  rowAssignee,
  rowId,
  rowLastActivityAt,
  rowPriority,
  rowProject,
  rowType,
  rowUrgency,
  threadOwner,
  threadReferenceRoute,
} from "@upstream-dispatch/features/inbox/list-row";
export type { MarkAllRead } from "@upstream-dispatch/features/inbox/mark-all";
export {
  applyMarkAll,
  MARK_ALL_REFUSED_TEXT,
  MARK_ALL_STOPPED_TEXT,
  markAllReadBody,
  marksThread,
  readRow,
  useMarkAllRead,
} from "@upstream-dispatch/features/inbox/mark-all";
export { useMotionHold } from "@upstream-dispatch/features/inbox/motion-hold";
export type {
  AskPress,
  OutstandingAnswerWriteOptions,
} from "@upstream-dispatch/features/inbox/outstanding-answers";
export {
  answerOutstanding,
  markAnswerOutstanding,
  useOutstandingAnswerWrite,
} from "@upstream-dispatch/features/inbox/outstanding-answers";
export {
  askArtifactId,
  invalidateOwnerReads,
} from "@upstream-dispatch/features/inbox/owner-reads";
export type { SectionHold } from "@upstream-dispatch/features/inbox/pane-placement";
export { holdSection } from "@upstream-dispatch/features/inbox/pane-placement";
export type {
  PaneSelection,
  PaneSelectionOptions,
  PlacedRow,
} from "@upstream-dispatch/features/inbox/pane-selection";
export { usePaneSelection } from "@upstream-dispatch/features/inbox/pane-selection";
export { useFoldedGroups } from "@upstream-dispatch/features/inbox/preferences";
export {
  clearReplyDraft,
  reloadReplyDrafts,
  replyDraftsSignedIn,
  replyDraftsSignedOut,
  setReplyDraft,
  useReplyDraft,
} from "@upstream-dispatch/features/inbox/reply-drafts";
export type { InboxSection } from "@upstream-dispatch/features/inbox/sections";
export {
  EVERYONE_FILTER_VALUE,
  INBOX_SECTIONS,
  inAssigneeFilter,
  isMine,
  isOwnList,
  isUnassigned,
  sectionOf,
  sectionTitles,
  UNASSIGNED_FILTER_VALUE,
} from "@upstream-dispatch/features/inbox/sections";
export type { SnoozePreset } from "@upstream-dispatch/features/inbox/snooze";
export {
  isIndefinite,
  isSnoozed,
  SNOOZE_INDEFINITE,
  SNOOZE_PRESETS,
} from "@upstream-dispatch/features/inbox/snooze";
export { useAskAnswerForm } from "@upstream-dispatch/features/inbox/useAskAnswerForm";
export type { AskHandOnWrite } from "@upstream-dispatch/features/inbox/useAskHandOn";
export { useAskHandOn } from "@upstream-dispatch/features/inbox/useAskHandOn";
export type {
  AskSnoozeFailure,
  AskSnoozeManyWrite,
  AskSnoozeWrite,
} from "@upstream-dispatch/features/inbox/useAskSnooze";
export {
  useAskSnooze,
  useAskSnoozeMany,
} from "@upstream-dispatch/features/inbox/useAskSnooze";
export {
  useInboxCount,
  useUnreadThreadCount,
} from "@upstream-dispatch/features/inbox/useInboxCount";
export type {
  InboxDismiss,
  InboxDismissInput,
  InboxDismissRow,
} from "@upstream-dispatch/features/inbox/useInboxDismiss";
export {
  dismissesThread,
  dismissRefusalText,
  dismissRow,
  dismissStoppedText,
  dismissThreadRow,
  inboxDismissBody,
  useInboxDismiss,
} from "@upstream-dispatch/features/inbox/useInboxDismiss";
export type { InboxSelection } from "@upstream-dispatch/features/inbox/useInboxSelection";
export { useInboxSelection } from "@upstream-dispatch/features/inbox/useInboxSelection";
export type { InboxThreadRows } from "@upstream-dispatch/features/inbox/useInboxThreadRows";
export { useInboxThreadRows } from "@upstream-dispatch/features/inbox/useInboxThreadRows";
export type { InboxWriteScope } from "@upstream-dispatch/features/inbox/write-scope";
export {
  inboxWriteScope,
  inWriteScope,
  sameWriteScope,
  scopeKinds,
} from "@upstream-dispatch/features/inbox/write-scope";
export type { InboxGroupBy, InboxRoute } from "@upstream-dispatch/features/refs/routes";
export { INBOX_FILTER_FIELDS } from "@upstream-dispatch/features/refs/routes";
export { capSearchQuery } from "@upstream-dispatch/lib/query-param";
