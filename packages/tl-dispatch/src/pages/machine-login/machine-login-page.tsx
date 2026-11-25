import type { ReactNode } from "react";

import { Button } from "@/ui/button";
import { SurfaceTitle } from "@/ui/heading";
import { Input } from "@/ui/input";
import { writeFailureNote } from "@/writes/write-failure-note";
import { DecisionButtons } from "./decision-buttons";
import { MachineLogins } from "./machine-logins";
import { RecordFacts } from "./record-facts";
import { apiErrorMessage, machineName, useDocumentTitle } from "./upstream";
import { useMachineLogin } from "./use-machine-login";

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
  const { code, typeCode, lookUp, lookup, approve, deny, submitGuard, view } = useMachineLogin();
  useDocumentTitle("Machine login · Dispatch");

  return (
    <section className="max-w-5xl space-y-8">
      <div className="max-w-2xl space-y-8">
        <SurfaceTitle className="text-balance" size="page">
          Enter machine login code
        </SurfaceTitle>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            lookUp();
          }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="machine-code">
              Code shown on the machine
            </label>
            <Input
              autoComplete="off"
              className="font-mono tracking-widest"
              id="machine-code"
              onChange={(event) => typeCode(event.target.value)}
              placeholder="XXXX-XXXX"
              value={code}
            />
          </div>
          <Button disabled={lookup.isPending || code.trim() === ""} type="submit">
            Look up
          </Button>
        </form>
        {lookup.isError ? (
          <p className="text-sm text-destructive">
            {writeFailureNote(lookup.error, {
              what: "the lookup of that code",
              anew: "Look up sends the code in the field as a new lookup.",
              refused: (error) => apiErrorMessage(error, "Could not look up that code."),
            })}
          </p>
        ) : null}
        {view === undefined ? null : (
          <div className="space-y-4 border border-border bg-card p-4">
            <RecordFacts record={view.record} />
            {view.record.state === "expired" ? (
              <p className="text-sm font-medium text-foreground">
                This login expired before anyone decided it.
              </p>
            ) : view.decided !== null ? (
              <Decision
                credentialId={view.decided.credential_id}
                event={view.decided.event}
                host={view.record.identifiers?.[0] ?? ""}
                service={view.record.service}
              />
            ) : view.record.state === "pending" ? (
              <DecisionButtons
                approve={view.record.service === null ? approve : undefined}
                deny={deny}
                submitGuard={submitGuard}
              />
            ) : null}
          </div>
        )}
      </div>
      <MachineLogins />
    </section>
  );
}
