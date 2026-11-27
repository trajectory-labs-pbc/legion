// The tests' one door to upstream besides the seam: its test helpers, and the modules that only
// tests read. A module that the seam gives is read through the seam, its test-only names included.
export { DISPATCH_HREF_REFERENCES } from "@legion/contracts";
export { quietConsoleError } from "@upstream-dispatch/__tests__/act-warnings";
export { onFakeClock, realClock, settle, tick } from "@upstream-dispatch/__tests__/fake-clock";
export { keyedAttempt } from "@upstream-dispatch/__tests__/keyed-attempt";
export { installFakeLiveSockets } from "@upstream-dispatch/__tests__/live-socket-harness";
export { answerRequests } from "@upstream-dispatch/__tests__/network";
export { renderWithQueries } from "@upstream-dispatch/__tests__/query-provider";
export { stopTheLateWrite } from "@upstream-dispatch/__tests__/stop-late-write";
export { userOnFakeClock } from "@upstream-dispatch/__tests__/user";
export { LabelPill, StatusPill } from "@upstream-dispatch/components/Pill";
export { GrantsSection } from "@upstream-dispatch/features/credentials/GrantsSection";
export { DeliverySettingsForm } from "@upstream-dispatch/features/delivery/DeliverySettingsForm";
export { answerDraft, setAnswerDraft } from "@upstream-dispatch/features/inbox/answer-drafts";
export { isDecisionAsk } from "@upstream-dispatch/features/inbox/ask-decision";
export { createDraftStore, DRAFT_KEPT_UNITS } from "@upstream-dispatch/features/inbox/draft-store";
export { issueAsk } from "@upstream-dispatch/features/inbox/inbox-fixture";
export { UnreadDot } from "@upstream-dispatch/features/project/UnreadDot";
// Functions of the reference preview's module; a widget file gives only marked components, or a name `UNMARKED` lists.
export {
  closeRefPreview,
  referenceTriggerProps,
} from "@upstream-dispatch/features/refs/RefPreview";
export { replyRow } from "@upstream-dispatch/features/threads/replies-fixture";
export {
  ASK_BLOCK_PILL_BLOCKING_BG,
  ASK_BLOCK_PILL_HIGH_BG,
  ASK_BLOCK_PILL_MED_BG,
  askBlockTint,
  askUrgencyAccent,
  BORDER_DEFAULT,
  BORDER_STRONG,
  borderDefault,
  CALLOUT_DANGER_BG,
  CALLOUT_INFO_BG,
  CALLOUT_WARNING_BG,
  CARD_HOVER_ACCENT,
  CONTRAST_CHECKS,
  CONTROL_HOVER_ACCENT,
  type ColorPair,
  card,
  DANGER_HOVER_BORDER,
  DANGER_HOVER_TEXT,
  DANGER_TEXT,
  decisionUnsureBorder,
  iconRailActive,
  issueStatusScale,
  LINK,
  LINK_HOVER,
  PAGE_COLORS,
  pageComposer,
  pageFocusedRow,
  pageFoldedHalo,
  pageLineBorder,
  pageOwnWordsRule,
  primaryButtonBg,
  primaryButtonDisabled,
  railBg,
  railBorder,
  railText,
  SUCCESS_HOVER_TEXT,
  SUCCESS_TEXT,
  SURFACE,
  SURFACE_MUTED,
  selectedCardBg,
  selectedCardBorder,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "@upstream-dispatch/theme/classes";
export { contrastRatio, type Oklch } from "@upstream-dispatch/theme/contrast";
