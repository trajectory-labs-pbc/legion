import { Button } from "@legion/ui/components/button";
import type { ReactNode } from "react";
import { WriteFailure } from "@/data/write-failure";
import { apiErrorMessage } from "@/upstream/api";
import type { DecisionResponse, StateResponse } from "@/upstream/contract";
import type { SubmitGuard } from "@/upstream/writes";
import type { KeyedWrite } from "./use-machine-login";

/** Approve and Deny for a pending machine login; with no `approve`, only Deny shows. One decision is out at a time. */
export function DecisionButtons({
  approve,
  deny,
  submitGuard,
}: {
  approve?: KeyedWrite<DecisionResponse>;
  deny: KeyedWrite<StateResponse>;
  submitGuard: SubmitGuard;
}): ReactNode {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {approve === undefined ? null : (
          <Button
            disabled={deny.isPending}
            loading={approve.isPending}
            onClick={() => submitGuard.guard(() => approve.mutate())}
          >
            Approve
          </Button>
        )}
        <Button
          disabled={approve?.isPending === true}
          loading={deny.isPending}
          onClick={() => submitGuard.guard(() => deny.mutate())}
          variant="outline"
        >
          Deny
        </Button>
      </div>
      {/* A stopped decision may have been made; pressing again sends a new one. */}
      {approve?.isError ? (
        <WriteFailure
          anew="Pressing Approve again sends a new approval."
          error={approve.error}
          refused={(error) => apiErrorMessage(error, "Could not approve this request.")}
          what="the approval"
        />
      ) : null}
      {deny.isError ? (
        <WriteFailure
          anew="Pressing Deny again sends a new denial."
          error={deny.error}
          refused={(error) => apiErrorMessage(error, "Could not deny this request.")}
          what="the denial"
        />
      ) : null}
    </div>
  );
}
