import { useKeyedWrite, useRefusalOfSubject, useSubmitGuard, type WriteBounds } from "./upstream";

export interface Revoke<Row> {
  /** Asks first, then revokes the row. */
  press: (row: Row) => void;
  /** A revoke is out. */
  pending: boolean;
  /** The row whose revoke failed, while it is still listed. */
  refused: Row | undefined;
  /** Why that revoke failed. */
  error: unknown;
}

/** Revokes one row of a list, after its question, and holds the failure while the row is listed. */
export function useRevoke<Row>({
  confirm,
  label,
  listed,
  onRevoked,
  revoke,
  rowKey,
}: {
  /** The question a Revoke asks first. */
  confirm: (row: Row) => string;
  /** The revoke as the pending writes name it. */
  label: (row: Row) => string;
  /** The rows the list shows now. */
  listed: readonly Row[] | undefined;
  onRevoked: () => void;
  revoke: (row: Row, bounds: WriteBounds) => Promise<void>;
  rowKey: (row: Row) => string;
}): Revoke<Row> {
  const submitGuard = useSubmitGuard();
  const mutation = useKeyedWrite({
    method: "POST",
    inline: true,
    label,
    onSettled: () => submitGuard.release(),
    onSuccess: onRevoked,
    write: revoke,
  });
  // The refusal goes once its row leaves the list.
  const refused = useRefusalOfSubject(
    mutation,
    (row) => listed?.some((other) => rowKey(other) === rowKey(row)) === true
  );
  return {
    press: (row) => {
      if (window.confirm(confirm(row))) submitGuard.guard(() => mutation.mutate(row));
    },
    pending: mutation.isPending,
    refused: refused ? mutation.variables : undefined,
    error: mutation.error,
  };
}
