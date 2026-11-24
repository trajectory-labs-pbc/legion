import { useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@upstream-dispatch/api/client";
import type { DecisionResponse, StateResponse } from "@upstream-dispatch/api/types";
import {
  machineLoginsQuery,
  machineName,
} from "@upstream-dispatch/features/credentials/machineLogins";
import { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
import { useKeyedWrite } from "@upstream-dispatch/features/writes/useKeyedWrite";
import { useSubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
import { type FormEvent, type ReactNode, useState } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { DecisionButtons } from "./DecisionButtons";
import { MachineLogins } from "./MachineLogins";
import { RecordFacts } from "./RecordFacts";

/** The login's decision, in place of the buttons that decide it. */
function Decision({
  credentialId,
  event,
  host,
  service,
}: {
  credentialId: string | null;
  event: string;
  host: string;
  service: string | null;
}): ReactNode {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">
        {event !== "approved" ? (
          <>
            <span className="capitalize">{event}</span>. {host} is not logged in.
          </>
        ) : (
          `Approved. ${machineName({ host, service })} can start ${service ? `worker pods as ${service}` : "agent sessions as you"}.`
        )}
      </p>
      {credentialId === null ? null : (
        <p className="text-muted-foreground">
          Credential <span className="font-mono text-xs">{credentialId}</span>
        </p>
      )}
    </div>
  );
}

/** The person types the code a machine printed, then approves or denies that machine's login. */
export function MachineLoginPage(): ReactNode {
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

  const approve = useKeyedWrite<DecisionResponse>({
    method: "POST",
    write: (_variables, bounds) =>
      api.approveCredentialRecord(record?.record_id ?? "", { code: lookedUpCode }, bounds),
    inline: true,
    label: () => "Approval of a machine login",
    onSettled: () => submitGuard.release(),
    onSuccess: (decided) => {
      void queryClient.invalidateQueries({ queryKey: ["credential-pending"] });
      void queryClient.invalidateQueries({ queryKey: machineLoginsQuery().queryKey });
      if (decided === null) lookup.mutate(lookedUpCode);
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
      void queryClient.invalidateQueries({ queryKey: ["credential-pending"] });
      if (decided === null) lookup.mutate(lookedUpCode);
    },
  });

  useDocumentTitle("Machine login · Dispatch");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitGuard.guard(() => {
      approve.reset();
      deny.reset();
      lookup.mutate(code);
    });
  };
  const madeHere = approve.data ?? deny.data ?? undefined;
  const view =
    record === undefined
      ? undefined
      : madeHere === undefined
        ? { decided: record.decided, record }
        : {
            decided: {
              credential_id:
                madeHere.state === "approved" && "credential_id" in madeHere
                  ? madeHere.credential_id
                  : null,
              event: madeHere.state,
            },
            record: { ...record, state: madeHere.state },
          };

  return (
    <section className="max-w-5xl space-y-8">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-xl font-semibold text-balance text-foreground">
          Enter machine login code
        </h1>
        <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="machine-code">
              Code shown on the machine
            </label>
            <Input
              autoComplete="off"
              className="font-mono tracking-widest"
              id="machine-code"
              onChange={(event) => {
                const cleaned = event.target.value
                  .toUpperCase()
                  .replaceAll(/[^A-Z0-9]/g, "")
                  .slice(0, 8);
                setCode(
                  cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned
                );
              }}
              placeholder="XXXX-XXXX"
              value={code}
            />
          </div>
          <Button disabled={lookup.isPending || code.trim() === ""} type="submit" variant="primary">
            Look up
          </Button>
        </form>
        {lookup.isError ? (
          <p className="text-sm text-destructive">
            {apiErrorMessage(lookup.error, "Could not look up that code.")}
          </p>
        ) : null}
        {view === undefined ? null : (
          <div className="space-y-4 border border-border bg-card p-4">
            <RecordFacts record={view.record} />
            {view.decided === null ? (
              <DecisionButtons
                approve={view.record.service === null ? approve : undefined}
                deny={deny}
                submitGuard={submitGuard}
              />
            ) : (
              <Decision
                credentialId={view.decided.credential_id}
                event={view.decided.event}
                host={view.record.identifiers?.[0] ?? ""}
                service={view.record.service}
              />
            )}
          </div>
        )}
      </div>
      <MachineLogins />
    </section>
  );
}
