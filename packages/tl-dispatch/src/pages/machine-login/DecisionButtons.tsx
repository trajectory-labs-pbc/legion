import type { UseMutationResult } from "@tanstack/react-query";
import { apiErrorMessage } from "@upstream-dispatch/api/client";
import type { DecisionResponse, StateResponse } from "@upstream-dispatch/api/types";
import type { SubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
import type { ReactNode } from "react";

import { Button } from "../../ui/button";

/** Approve and Deny for a pending machine login; with no `approve`, only Deny shows. */
export function DecisionButtons({
  approve,
  deny,
  submitGuard,
}: {
  approve?: UseMutationResult<DecisionResponse | null, Error, void>;
  deny: UseMutationResult<StateResponse | null, Error, void>;
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
      {approve?.isError ? (
        <p className="text-sm text-destructive">
          {apiErrorMessage(approve.error, "Could not approve this request.")}
        </p>
      ) : null}
      {deny.isError ? (
        <p className="text-sm text-destructive">
          {apiErrorMessage(deny.error, "Could not deny this request.")}
        </p>
      ) : null}
    </div>
  );
}
