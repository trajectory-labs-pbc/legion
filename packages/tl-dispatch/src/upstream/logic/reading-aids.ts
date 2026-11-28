// Upstream's logic of the reading aids: the document a reference names, the references Read
// first draws, and whose turn an ask is and how urgent.
export { askTurnHolder } from "@upstream-dispatch/features/inbox/ask-turn";
export { askUrgency, URGENCY_LABELS } from "@upstream-dispatch/features/inbox/ask-urgency";
export { askWaitingOnPerson } from "@upstream-dispatch/features/inbox/list-row";
export { actorLabelText } from "@upstream-dispatch/features/refs/AgentName";
export {
  buildDispatchReference,
  documentRoute,
  type ProjectDocumentRoute,
  parseNodeReference,
} from "@upstream-dispatch/features/refs/routes";
export {
  type TextSource,
  textSourceOf,
} from "@upstream-dispatch/features/refs/text-references";
