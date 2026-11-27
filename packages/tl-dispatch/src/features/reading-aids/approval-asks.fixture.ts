// Approval requests of the shape the asks read gives, for the aids' tests.
// Not upstream's `openAsk`: its fixture file imports `ProofDocument`, which the pure tests avoid.
import type { Ask } from "@upstream-dispatch/api/types";

import type { Named } from "./baseline";

type Approval = NonNullable<Ask["approval"]>;

/** An approval request of the shape the asks read gives; only its approval fields matter here. */
export function approvalAsk(
  lead: Named,
  {
    approved,
    documents,
    state = "open",
  }: { approved?: number; documents?: readonly Named[]; state?: Ask["state"] } = {}
): Ask {
  const approval: Approval = {
    ...lead,
    name: "spec.md",
    ...(approved === undefined
      ? {}
      : {
          approved: {
            at: "2026-11-01T00:00:00Z",
            by: { id: "reviewer", kind: "user" },
            version: approved,
          },
        }),
    // A server older than the list sends none.
    documents:
      documents === undefined ? null : documents.map((entry) => ({ ...entry, name: "doc.md" })),
  };
  return {
    anchor: null,
    answer: null,
    approval,
    asked_of: null,
    asked_of_at: null,
    asked_of_by: null,
    artifact_id: null,
    author: { id: "agent", kind: "session" },
    block_id: null,
    created_at: "2026-11-01T00:00:00Z",
    edited_at: null,
    id: `ask-${lead.artifact_id}-${lead.version}`,
    issue_key: "CORE-1",
    kind: "approval",
    multiple: false,
    opened_event_id: 1,
    options: null,
    question: "Approve the spec?",
    state,
    urgency: "med",
  };
}

/** A document a request names, at `version`, named at `requested_version`. */
export const at = (artifact_id: string, version: number, requested_version = version): Named => ({
  artifact_id,
  requested_version,
  version,
});
