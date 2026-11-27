// Every upstream module the machine login page uses, so an upstream rename breaks here alone.
import type { KeyedWriteResult } from "@upstream-dispatch/features/writes/useKeyedWrite";

export { api, apiErrorMessage } from "@upstream-dispatch/api/client";
export type {
  DecisionResponse,
  LauncherCredentialResp,
  RecordResponse,
  StateResponse,
} from "@upstream-dispatch/api/types";
export { credentialCapabilitiesQuery } from "@upstream-dispatch/features/credentials/capabilities";
export { credentialGrantsQuery } from "@upstream-dispatch/features/credentials/grants";
export {
  machineLoginsQuery,
  machineName,
} from "@upstream-dispatch/features/credentials/machineLogins";
export { credentialPendingQuery } from "@upstream-dispatch/features/credentials/pending";
export {
  type FocusFallback,
  useFocusKeeper,
} from "@upstream-dispatch/features/issue-page/focus-keeper";
export { firstUsable } from "@upstream-dispatch/features/issue-page/usable-control";
export { Timestamp } from "@upstream-dispatch/features/refs/Timestamp";
export { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
export { stoppedWriteNote } from "@upstream-dispatch/features/writes/keyed-write";
export {
  refusedNote,
  useKeyedWrite,
  useRefusalOfSubject,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
export { type SubmitGuard, useSubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";

/** A keyed write as `useKeyedWrite` returns it. */
export type KeyedWrite<TData, TVariables = void> = KeyedWriteResult<TData, TVariables, unknown>;
