// What "Read first" lists, from the asks read, the issue read and the editor's blocks.
import type { IssueDetails, useAsksRead } from "@/data/document-reads";

/** An ask as the asks read answers it: an issue's row, or a project document's. */
export type Ask = NonNullable<ReturnType<typeof useAsksRead>["data"]>[number];
type IssueArtifact = NonNullable<IssueDetails["artifacts"]>[number];
type NamedDocument = NonNullable<NonNullable<Ask["approval"]>["documents"]>[number];

/** One document an approval request names, with the issue's own document when it may be a link. */
export interface RequestedDocument {
  readonly artifactId: string;
  readonly name: string;
  /** The version to approve. */
  readonly version: number;
  /** The issue's document to link to; absent for the page's own document and an unlisted one. */
  readonly link?: IssueArtifact;
}

export interface ApprovalRequest {
  readonly ask: Ask;
  readonly documents: readonly RequestedDocument[];
}

/** The documents a request names: its list, or its lead fields from a server older than it. */
export function requestDocuments(ask: Ask): readonly NamedDocument[] {
  const approval = ask.approval;
  if (approval === undefined) return [];
  return approval.documents ?? [approval];
}

/** Each open approval request that names the document `artifactId`, in the asks read's order. */
export function approvalRequests(
  asks: readonly Ask[],
  artifactId: string,
  issueArtifacts: readonly IssueArtifact[]
): ApprovalRequest[] {
  return asks.flatMap((ask) => {
    const named = ask.state === "open" ? requestDocuments(ask) : [];
    if (!named.some((each) => each.artifact_id === artifactId)) return [];
    const documents = named.map((each) => ({
      artifactId: each.artifact_id,
      link:
        each.artifact_id === artifactId
          ? undefined
          : issueArtifacts.find((artifact) => artifact.id === each.artifact_id),
      name: each.name,
      version: each.version,
    }));
    return [{ ask, documents }];
  });
}

export interface OpenDecision {
  readonly ask: Ask;
  readonly blockId: string;
}

/** The open decisions on the document `artifactId`, by the id of the block each stands in. */
export function openDecisionAsks(asks: readonly Ask[], artifactId: string): Map<string, Ask> {
  return new Map(
    asks.flatMap((ask) =>
      ask.state === "open" &&
      ask.block_artifact?.id === artifactId &&
      typeof ask.block_id === "string"
        ? [[ask.block_id, ask] as const]
        : []
    )
  );
}

/** The open decisions whose blocks the document shows, in the order `shown` gives them. */
export const openDecisions = (
  open: ReadonlyMap<string, Ask>,
  shown: readonly string[]
): OpenDecision[] =>
  shown.flatMap((blockId) => {
    const ask = open.get(blockId);
    return ask === undefined ? [] : [{ ask, blockId }];
  });

/** Whether `list` holds at least one item. */
export const isNonEmpty = <T>(list: readonly T[]): list is readonly [T, ...T[]] => list.length > 0;

/** The decision after `current` in the list, or before it, wrapping at the ends. */
export function stepDecision(
  decisions: readonly [OpenDecision, ...OpenDecision[]],
  current: string | undefined,
  step: 1 | -1
): OpenDecision {
  const at = decisions.findIndex((decision) => decision.blockId === current);
  const from = at === -1 && step === -1 ? 0 : at;
  return decisions[(from + step + decisions.length) % decisions.length] ?? decisions[0];
}
