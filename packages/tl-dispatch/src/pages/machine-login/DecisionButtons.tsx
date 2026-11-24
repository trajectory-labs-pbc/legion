import type { ReactNode } from "react";

import { Button } from "../../ui/button";
import {
  apiErrorMessage,
  type DecisionResponse,
  type KeyedWrite,
  SendStoppedError,
  type StateResponse,
  type SubmitGuard,
  stoppedWriteNote,
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
          <Button
            disabled={deciding}
            onClick={() => submitGuard.guard(() => approve.mutate())}
            variant="primary"
          >
            Approve
          </Button>
        )}
        <Button disabled={deciding} onClick={() => submitGuard.guard(() => deny.mutate())}>
          Deny
        </Button>
      </div>
      {/* A stopped decision may have been made; pressing again sends a new one. */}
      {approve?.isError ? (
        <p className="text-sm text-destructive">
          {approve.error instanceof SendStoppedError
            ? stoppedWriteNote("the approval", "made", {
                anew: "Pressing Approve again sends a new approval.",
              })
            : apiErrorMessage(approve.error, "Could not approve this request.")}
        </p>
      ) : null}
      {deny.isError ? (
        <p className="text-sm text-destructive">
          {deny.error instanceof SendStoppedError
            ? stoppedWriteNote("the denial", "made", {
                anew: "Pressing Deny again sends a new denial.",
              })
            : apiErrorMessage(deny.error, "Could not deny this request.")}
        </p>
      ) : null}
    </div>
  );
}
