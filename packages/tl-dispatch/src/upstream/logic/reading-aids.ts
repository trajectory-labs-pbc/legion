// Upstream's logic of the reading aids: the document a reference names, the references Read
// first draws, whose turn an ask is and how urgent, and a document's versions.
export { isText } from "@upstream-dispatch/api/artifact-version";
export {
  versionLabel,
  versionsNewestFirst,
} from "@upstream-dispatch/features/artifacts/ArtifactHeader";
export { askTurnHolder } from "@upstream-dispatch/features/inbox/ask-turn";
export { askUrgency, URGENCY_LABELS } from "@upstream-dispatch/features/inbox/ask-urgency";
export { askWaitingOnPerson } from "@upstream-dispatch/features/inbox/list-row";
export { actorLabelText } from "@upstream-dispatch/features/refs/AgentName";
export {
  buildDispatchReference,
  type DispatchReferenceRoute,
  documentRoute,
  type ProjectDocumentRoute,
  parseNodeReference,
} from "@upstream-dispatch/features/refs/routes";
export {
  type TextSource,
  textSourceOf,
} from "@upstream-dispatch/features/refs/text-references";
