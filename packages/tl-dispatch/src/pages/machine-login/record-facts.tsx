import { Heading, HeadingSection } from "@legion/ui/components/heading";
import type { ReactNode } from "react";

import { type RecordResponse, Timestamp } from "./upstream";

const LIFETIME_UNITS: ReadonlyArray<{ seconds: number; unit: string }> = [
  { seconds: 86400, unit: "day" },
  { seconds: 3600, unit: "hour" },
  { seconds: 60, unit: "minute" },
];

function formatLifetime(seconds: number | null): string {
  if (seconds === null) return "until the session ends";
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

/** A looked-up machine login: what it asks, its durations, its approver and its reason. */
export function RecordFacts({ record }: { record: RecordResponse }): ReactNode {
  const pending = record.state === "pending";
  return (
    <div className="space-y-3">
      <Heading className="font-medium text-pretty" size="section">
        <span className="font-semibold wrap-anywhere">{(record.identifiers ?? []).join(", ")}</span>{" "}
        {pending ? "asks" : "asked"} to start{" "}
        {record.service ? `worker pods as ${record.service}` : "agent sessions as you"}
      </Heading>
      <div className="text-sm">
        <p className="flex h-8 items-center">
          Login lasts {formatLifetime(record.lifetime_seconds)}
        </p>
        {pending || record.state === "expired" ? (
          <p className="flex h-8 items-center gap-1">
            Request {pending ? "expires" : "expired"}
            <Timestamp at={record.expires_at} className="tabular-nums" />
          </p>
        ) : null}
        <p className="flex h-8 items-center">
          Approver:{" "}
          {record.approver === ANYONE_APPROVER ? "Anyone signed in to Dispatch" : record.approver}
        </p>
        <p className="text-xs text-muted-foreground">
          Requested <Timestamp at={record.requested_at} className="tabular-nums" /> · Policy{" "}
          <span className="font-mono">{record.rules_version}</span>
        </p>
      </div>
      {record.reason === "" ? null : (
        <div>
          <HeadingSection>
            <Heading size="group" tone="muted">
              The agent's stated reason
            </Heading>
            <blockquote className="mt-1 border-l-2 border-border pl-3 text-sm whitespace-pre-wrap text-foreground">
              {record.reason}
            </blockquote>
          </HeadingSection>
        </div>
      )}
      {pending && record.service ? (
        <p className="text-sm text-pretty text-muted-foreground">
          It is a service's login from before services logged in with their own Kubernetes token,
          and no one can approve it any more: deny it, or let it expire.
        </p>
      ) : null}
    </div>
  );
}
