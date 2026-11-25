import { Button } from "@legion/ui/components/button";
import type { ReactNode } from "react";
import { writeFailureNote } from "@/writes/write-failure-note";
import {
  apiErrorMessage,
  type DecisionResponse,
  type KeyedWrite,
  type StateResponse,
  type SubmitGuard,
} from "./upstream";

/** Approve and Deny for a pending machine login; with no `approve`, only Deny shows. */
export function DecisionButtons({
  approve,
  deny,
  submitGuard,
}: {
  approve?: KeyedWrite<DecisionResponse>;
  deny: KeyedWrite<StateResponse>;
  submitGuard: SubmitGuard;
}): ReactNode {
  const deciding = approve?.isPending === true || deny.isPending;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {approve === undefined ? null : (
          <Button disabled={deciding} onClick={() => submitGuard.guard(() => approve.mutate())}>
            Approve
          </Button>
        )}
        <Button
          disabled={deciding}
          onClick={() => submitGuard.guard(() => deny.mutate())}
          variant="outline"
        >
          Deny
        </Button>
      </div>
      {/* A stopped decision may have been made; pressing again sends a new one. */}
      {approve?.isError ? (
        <p className="text-sm text-destructive">
          {writeFailureNote(approve.error, {
            what: "the approval",
            anew: "Pressing Approve again sends a new approval.",
            refused: (error) => apiErrorMessage(error, "Could not approve this request."),
          })}
        </p>
      ) : null}
      {deny.isError ? (
        <p className="text-sm text-destructive">
          {writeFailureNote(deny.error, {
            what: "the denial",
            anew: "Pressing Deny again sends a new denial.",
            refused: (error) => apiErrorMessage(error, "Could not deny this request."),
          })}
        </p>
      ) : null}
    </div>
  );
}
