// What the reading aids take from upstream's document editor: its runtime, its editor, and the
// helpers the aids' parts move the caret and the focus with.
export { BLOCK_ID_ATTRIBUTE } from "@upstream-dispatch/features/doc/block-id";
export {
  type ConnectDocument,
  type ConnectionCallbacks,
  type DocumentConnection,
  loadDocumentTransport,
} from "@upstream-dispatch/features/doc/connection";
export {
  type CreateEditor,
  createEditor,
  type EditorHandle,
  type EditorOptions,
} from "@upstream-dispatch/features/doc/editor";
export { refocusWhenSettled } from "@upstream-dispatch/features/doc/refocus-when-settled";
export {
  DocumentRuntime,
  type DocumentRuntimeValue,
} from "@upstream-dispatch/features/doc/runtime";
export { EDITOR_BOX_ATTRIBUTE } from "@upstream-dispatch/features/issue-page/node-caret";
export { blockFragment } from "@upstream-dispatch/features/refs/block-reference";
