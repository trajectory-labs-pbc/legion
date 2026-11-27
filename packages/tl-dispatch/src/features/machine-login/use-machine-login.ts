import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, apiErrorCodeIn } from "@/upstream/api";
import type { DecisionResponse, RecordResponse, StateResponse } from "@/upstream/contract";
import { credentialPendingQuery, machineLoginsQuery } from "@/upstream/queries";
import {
  type KeyedWriteResult,
  type SubmitGuard,
  useKeyedWrite,
  useSubmitGuard,
} from "@/upstream/writes";
import { formatMachineCode } from "./format-machine-code";

/** A keyed write as `useKeyedWrite` returns it. */
export type KeyedWrite<TData, TVariables = void> = KeyedWriteResult<TData, TVariables, unknown>;

/** A looked-up login as the page shows it: its record, and its decision once one is made. */
interface MachineLoginView {
  record: RecordResponse;
  decided: { credential_id: string | null; event: string } | null;
}

interface MachineLogin {
  /** The code in the field, formatted; a decision on that code empties it for the next machine. */
  code: string;
  typeCode(typed: string): void;
  /** Looks the field's code up, forgetting any decision made on the login shown before. */
  lookUp(): void;
  lookup: KeyedWrite<RecordResponse, string>;
  /** How the field's code failed its lookup: the server refused that code, or the lookup failed
   *  for a reason that says nothing of it. Null when the field holds another code. */
  codeFailure: "refused" | "failed" | null;
  approve: KeyedWrite<DecisionResponse>;
  deny: KeyedWrite<StateResponse>;
  submitGuard: SubmitGuard;
  /** The login the last lookup found, with a decision made here in place of the record's own. */
  view: MachineLoginView | undefined;
}

/** The lookup's refusal that says the typed code is wrong. A blank code is never sent. */
const CODE_REFUSALS = new Set(["NO_SUCH_CODE"]);

/** The machine login page's state: the typed code, its lookup, and the two decisions. */
export function useMachineLogin(): MachineLogin {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();
  const submitGuard = useSubmitGuard();

  const lookup = useKeyedWrite({
    method: "POST",
    inline: true,
    label: () => "Lookup of a machine login code",
    onSettled: () => submitGuard.release(),
    write: (lookupCode: string, bounds) => api.lookupMachineCredential(lookupCode, bounds),
  });
  const record = lookup.data ?? undefined;
  // The code the shown record was looked up by, not what the field holds now.
  const lookedUpCode = lookup.variables ?? "";
  // A decision empties the field for the next machine, unless another code was typed meanwhile.
  const clearDecided = (decidedCode: string) =>
    setCode((typed) => (typed === decidedCode ? "" : typed));
  // A decision someone else made first is looked up again; the field empties once that shows.
  const settle = (decided: unknown) => {
    if (decided !== null) clearDecided(lookedUpCode);
    else lookup.mutate(lookedUpCode, { onSuccess: () => clearDecided(lookedUpCode) });
  };

  const approve = useKeyedWrite<DecisionResponse>({
    method: "POST",
    write: (_variables, bounds) =>
      api.approveCredentialRecord(record?.record_id ?? "", { code: lookedUpCode }, bounds),
    inline: true,
    label: () => "Approval of a machine login",
    onSettled: () => submitGuard.release(),
    onSuccess: (decided) => {
      void queryClient.invalidateQueries({ queryKey: credentialPendingQuery().queryKey });
      void queryClient.invalidateQueries({ queryKey: machineLoginsQuery().queryKey });
      settle(decided);
    },
  });
  const deny = useKeyedWrite<StateResponse>({
    method: "POST",
    write: (_variables, bounds) =>
      api.denyCredentialRecord(record?.record_id ?? "", { code: lookedUpCode }, bounds),
    inline: true,
    label: () => "Denial of a machine login",
    onSettled: () => submitGuard.release(),
    onSuccess: (decided) => {
      void queryClient.invalidateQueries({ queryKey: credentialPendingQuery().queryKey });
      settle(decided);
    },
  });

  return {
    code,
    typeCode: (typed) => setCode(formatMachineCode(typed)),
    lookUp: () =>
      submitGuard.guard(() => {
        approve.reset();
        deny.reset();
        lookup.mutate(code);
      }),
    lookup,
    codeFailure:
      lookup.isError && lookedUpCode === code
        ? apiErrorCodeIn(lookup.error, CODE_REFUSALS)
          ? "refused"
          : "failed"
        : null,
    approve,
    deny,
    submitGuard,
    view:
      record === undefined
        ? undefined
        : viewOf(record, approve.data ?? undefined, deny.data ?? undefined),
  };
}

/** An approval names the credential it minted; a denial names none. */
function viewOf(
  record: RecordResponse,
  approved: DecisionResponse | undefined,
  denied: StateResponse | undefined
): MachineLoginView {
  const made = approved ?? denied;
  return made === undefined
    ? { decided: record.decided, record }
    : {
        decided: { credential_id: approved?.credential_id ?? null, event: made.state },
        record: { ...record, state: made.state },
      };
}
