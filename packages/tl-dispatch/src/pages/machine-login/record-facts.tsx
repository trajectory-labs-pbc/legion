import { Fact, FactList } from "@legion/ui/components/fact";
import type { ReactNode } from "react";

import { machineName, type RecordResponse, Timestamp } from "./upstream";

const LIFETIME_UNITS: ReadonlyArray<{ seconds: number; unit: string }> = [
  { seconds: 86400, unit: "day" },
  { seconds: 3600, unit: "hour" },
  { seconds: 60, unit: "minute" },
];

function formatLifetime(seconds: number | null): string {
  if (seconds === null) return "Until the session ends";
  for (const { seconds: unitSeconds, unit } of LIFETIME_UNITS) {
    if (seconds >= unitSeconds) {
      const count = Math.round(seconds / unitSeconds);
      return `${count} ${unit}${count === 1 ? "" : "s"}`;
    }
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

// The approver a record names when any signed-in person may decide it.
const ANYONE_APPROVER = "anyone";

/** A looked-up machine login's facts, the agent's stated reason, and what approving it grants. */
export function RecordFacts({ record }: { record: RecordResponse }): ReactNode {
  const identifiers = record.identifiers ?? [];
  return (
    <div className="space-y-4">
      <FactList>
        <Fact label="Kind">Machine login</Fact>
        <Fact label="Identifiers">{identifiers.join(", ")}</Fact>
        <Fact label="Lifetime">{formatLifetime(record.lifetime_seconds)}</Fact>
        <Fact label="Requested">
          <Timestamp at={record.requested_at} className="tabular-nums" />
        </Fact>
        <Fact label="Expires">
          <Timestamp at={record.expires_at} className="tabular-nums" />
        </Fact>
        <Fact label="Policy version">
          <span className="font-mono text-xs">{record.rules_version}</span>
        </Fact>
        <Fact label="Approver">
          {record.approver === ANYONE_APPROVER ? "Anyone signed in to Dispatch" : record.approver}
        </Fact>
      </FactList>
      {record.reason === "" ? null : (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">The agent's stated reason</h2>
          <blockquote className="mt-1 border-l-2 border-border pl-3 text-sm whitespace-pre-wrap text-foreground">
            {record.reason}
          </blockquote>
        </div>
      )}
      {record.state === "pending" ? (
        <p className="text-sm font-medium text-pretty text-foreground">
          {record.service
            ? `${machineName({ host: identifiers[0] ?? "", service: record.service })} is a service's login from before services logged in with their own Kubernetes token, and no one can approve it any more: deny it, or let it expire.`
            : `Approving lets ${machineName({ host: identifiers[0] ?? "", service: null })} start agent sessions as you.`}
        </p>
      ) : null}
    </div>
  );
}
