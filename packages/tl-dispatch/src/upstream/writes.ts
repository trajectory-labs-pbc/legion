// Upstream's writes: the keyed write, the write store and the submit guard.
export { isConflict } from "@upstream-dispatch/features/writes/conflicts";
export { SendStoppedError, stoppedWriteNote } from "@upstream-dispatch/features/writes/keyed-write";
export type {
  KeyedWriteOptions,
  KeyedWriteResult,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
export {
  refusedNote,
  stoppedNote,
  useKeyedWrite,
  useRefusalOfSubject,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
export type { Write } from "@upstream-dispatch/features/writes/write-store";
export { plainWrite, writesOf } from "@upstream-dispatch/features/writes/write-store";
export type { SubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
export { useSubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
