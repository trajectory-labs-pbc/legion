import { Button } from "@legion/ui/components/button";
import { Card } from "@legion/ui/components/card";
import { SurfaceTitle } from "@legion/ui/components/heading";
import { Input } from "@legion/ui/components/input";
import { Label } from "@legion/ui/components/label";
import { textVariants } from "@legion/ui/lib/typography";
import { type ReactNode, useEffect, useRef } from "react";
import { WriteFailure } from "@/data/write-failure";
import { ApiError, apiErrorMessage } from "@/upstream/api";
import { machineName } from "@/upstream/logic/machine-login";
import { useDocumentTitle } from "@/upstream/shell";
import { DecisionButtons } from "./decision-buttons";
import { MachineLogins } from "./machine-logins";
import { RecordFacts } from "./record-facts";
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

/** The code form's failure line, which the code field names as its description. */
const CODE_ERROR = "machine-code-error";

/** The lookup's refusals that say the typed code is wrong; any other failure leaves it valid. */
const CODE_REFUSALS = new Set(["NO_SUCH_CODE", "CODE_REQUIRED"]);

/** The person types the code a machine printed, then approves or denies that machine's login. */
export function MachineLoginPage(): ReactNode {
  const { code, typeCode, lookUp, lookup, approve, deny, submitGuard, view } = useMachineLogin();
  useDocumentTitle("Machine login · Dispatch");
  const codeField = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);
  // The page has one field: typing goes there, not to the shortcuts. After the shell focuses main.
  useEffect(() => queueMicrotask(() => codeField.current?.focus()), []);
  // A decision, or the lookup after one, takes away the button that had the focus: the focus goes
  // to the result, else back to the field. Focus the person moved on stays where they put it.
  const decidedHere = view?.decided != null && (approve.isSuccess || deny.isSuccess);
  const settled = decidedHere || lookup.isError;
  useEffect(() => {
    if (!settled) return;
    const at = document.activeElement;
    if (at !== null && at !== document.body && !card.current?.contains(at)) return;
    (result.current ?? codeField.current)?.focus();
  }, [settled]);
  // Approve takes the primary from Look up when it shows; after a decision, a new code does.
  const approvable =
    view?.decided === null && view.record.state === "pending" && view.record.service === null;
  const lookUpLeads = !approvable && (view === undefined || code !== "");
  // The failure is the field's only while it still holds the code looked up.
  const codeFailed = lookup.isError && lookup.variables === code;
  const codeRefused =
    codeFailed && lookup.error instanceof ApiError && CODE_REFUSALS.has(lookup.error.code ?? "");

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
            aria-describedby={codeFailed ? CODE_ERROR : undefined}
            aria-invalid={codeRefused || undefined}
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
          id={CODE_ERROR}
          refused={(error) => apiErrorMessage(error, "Could not look up that code.")}
          what="the lookup of that code"
        />
      ) : null}
      {view === undefined ? null : (
        <Card className="px-4" ref={card}>
          <RecordFacts record={view.record} />
          {view.record.state === "expired" ? (
            <p className={textVariants({ weight: "medium" })}>
              This login expired before anyone decided it.
            </p>
          ) : view.decided !== null ? (
            <div
              className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              ref={result}
              tabIndex={-1}
            >
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
