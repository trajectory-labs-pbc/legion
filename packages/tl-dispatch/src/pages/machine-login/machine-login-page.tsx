import { Button } from "@legion/ui/components/button";
import { Card } from "@legion/ui/components/card";
import { SurfaceTitle } from "@legion/ui/components/heading";
import { Input } from "@legion/ui/components/input";
import { Label } from "@legion/ui/components/label";
import { textVariants } from "@legion/ui/lib/typography";
import { type ReactNode, useEffect, useRef } from "react";
import { WriteFailure } from "@/writes/write-failure";
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
    <div className="space-y-1">
      <p className={textVariants({ weight: "medium" })}>
        {event !== "approved" ? (
          <>
            <span className="capitalize">{event}</span>. {host} is not logged in.
          </>
        ) : (
          `Approved. ${machineName({ host, service })} can start ${service ? `worker pods as ${service}` : "agent sessions as you"}.`
        )}
      </p>
      {credentialId === null ? null : (
        <p className={textVariants({ tone: "muted" })}>
          Credential{" "}
          <span className={textVariants({ className: "font-mono", size: "caption" })}>
            {credentialId}
          </span>
        </p>
      )}
    </div>
  );
}

/** The person types the code a machine printed, then approves or denies that machine's login. */
export function MachineLoginPage(): ReactNode {
  const { code, typeCode, lookUp, lookup, approve, deny, submitGuard, view } = useMachineLogin();
  useDocumentTitle("Machine login · Dispatch");
  const codeField = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);
  // The page has one field: typing goes there, not to the shortcuts. After the shell focuses main.
  useEffect(() => queueMicrotask(() => codeField.current?.focus()), []);
  // A decision made here takes away the button that made it, so the focus goes to what it did.
  const decidedHere = view?.decided != null && (approve.isSuccess || deny.isSuccess);
  useEffect(() => {
    if (decidedHere) result.current?.focus();
  }, [decidedHere]);
  // Approve takes the primary from Look up when it shows; after a decision, a new code does.
  const approvable =
    view?.decided === null && view.record.state === "pending" && view.record.service === null;
  const lookUpLeads = !approvable && (view === undefined || code !== "");

  return (
    <section className="max-w-180 space-y-8">
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
          <Label htmlFor="machine-code">Code shown on the machine</Label>
          <Input
            autoComplete="off"
            className="font-mono"
            id="machine-code"
            onChange={(event) => typeCode(event.target.value)}
            placeholder="XXXX-XXXX"
            ref={codeField}
            value={code}
          />
        </div>
        <Button
          disabled={code.trim() === ""}
          loading={lookup.isPending}
          type="submit"
          variant={lookUpLeads ? "default" : "outline"}
        >
          Look up
        </Button>
      </form>
      {lookup.isError ? (
        <WriteFailure
          anew="Look up sends the code in the field as a new lookup."
          error={lookup.error}
          refused={(error) => apiErrorMessage(error, "Could not look up that code.")}
          what="the lookup of that code"
        />
      ) : null}
      {view === undefined ? null : (
        <Card className="px-4">
          <RecordFacts record={view.record} />
          {view.record.state === "expired" ? (
            <p className={textVariants({ weight: "medium" })}>
              This login expired before anyone decided it.
            </p>
          ) : view.decided !== null ? (
            <div className="outline-none" ref={result} tabIndex={-1}>
              <Decision
                credentialId={view.decided.credential_id}
                event={view.decided.event}
                host={view.record.identifiers?.[0] ?? ""}
                service={view.record.service}
              />
            </div>
          ) : view.record.state === "pending" ? (
            <DecisionButtons
              approve={approvable ? approve : undefined}
              deny={deny}
              submitGuard={submitGuard}
            />
          ) : null}
        </Card>
      )}
      <MachineLogins newCredential={approve.data?.credential_id ?? undefined} />
    </section>
  );
}
