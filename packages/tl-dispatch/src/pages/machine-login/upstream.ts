// Every upstream module the machine login page uses, so an upstream rename breaks here alone.
import { useKeyedWrite } from "@upstream-dispatch/features/writes/useKeyedWrite";

export { api, apiErrorMessage, type WriteBounds } from "@upstream-dispatch/api/client";
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
export { Timestamp } from "@upstream-dispatch/features/refs/Timestamp";
export { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
export { stoppedWriteNote } from "@upstream-dispatch/features/writes/keyed-write";
export {
  refusedNote,
  useRefusalOfSubject,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
export { type SubmitGuard, useSubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
export { useKeyedWrite };

/** A keyed write as `useKeyedWrite` returns it. */
export type KeyedWrite<TData, TVariables = void> = ReturnType<
  typeof useKeyedWrite<TData, TVariables>
>;
