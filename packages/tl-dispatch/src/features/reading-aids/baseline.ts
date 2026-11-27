import type { Ask } from "@upstream-dispatch/api/types";

import type { Refusal } from "@/features/read-failure";

/** A document an approval request names, with the version it named and the one it is at. */
export type Named = Pick<
  NonNullable<Ask["approval"]>,
  "artifact_id" | "requested_version" | "version"
>;

/** Why the marks compare with a version: approved before the open request, last read, or picked. */
export type BaselineKind = "approved" | "read" | "chosen";

/** The version the change marks compare the document with. */
export interface BaselineChoice {
  readonly kind: BaselineKind;
  readonly version: number;
}

/** Whether two choices name the same version for the same reason. */
export const sameChoice = (left: BaselineChoice, right: BaselineChoice) =>
  left.kind === right.kind && left.version === right.version;

/** Why a version gives no baseline to compare with, which asking again would not change. */
export type Unavailable = "file" | Refusal;

/** The approval of each open approval request, in the asks' order. */
const openApprovals = (asks: readonly Ask[]) =>
  asks.flatMap((ask) =>
    ask.kind === "approval" && ask.state === "open" && ask.approval !== undefined
      ? [ask.approval]
      : []
  );

/**
 * The visit's baseline: the version approved before the open request on the document, else the
 * reader's read mark at the visit's start, else none. A request that names the document only in
 * its `documents` list carries no approved version of it.
 */
export function baselineOf(
  asks: readonly Ask[],
  artifactId: string,
  readMark: number | null
): BaselineChoice | null {
  const request = openApprovals(asks).find((approval) => approval.artifact_id === artifactId);
  const approved = request?.approved?.version;
  if (approved !== undefined) return { kind: "approved", version: approved };
  return readMark === null ? null : { kind: "read", version: readMark };
}

/**
 * The version an open request named the document at, when the document changed since: its own
 * entry of `documents`, or the lead fields from a server older than the list.
 */
export function textChangedSince(asks: readonly Ask[], artifactId: string): number | undefined {
  for (const approval of openApprovals(asks)) {
    const entries: readonly Named[] = approval.documents ?? [approval];
    const named = entries.find((entry) => entry.artifact_id === artifactId);
    if (named !== undefined && named.version > named.requested_version) {
      return named.requested_version;
    }
  }
  return undefined;
}

const SINCE: Readonly<Record<BaselineKind, string>> = {
  approved: ", the last approved version",
  chosen: "",
  read: ", the version you last read",
};

/** How the line names a version. */
const versionName = (version: number) => `v${version}`;

/** What the counts line names the baseline by. */
export const baselineText = ({ kind, version }: BaselineChoice) =>
  `Since ${versionName(version)}${SINCE[kind]}`;

/** What the line says when nothing changed since `version`. */
export const noChangesText = (version: number) => `No changes since ${versionName(version)}`;

/** The note that the document changed since the version the request named. */
export const textChangedText = (version: number) =>
  `The text changed since ${versionName(version)}, the version that the request named`;

const UNAVAILABLE: Readonly<Record<Unavailable, (name: string) => string>> = {
  file: (name) => `${name} has no text to compare`,
  forbidden: (name) => `You cannot see ${name}`,
  "not-found": (name) => `${name} is not found`,
};

/** What the line says when `version` gives no baseline, and why. */
export const unavailableText = (version: number, why: Unavailable) =>
  UNAVAILABLE[why](versionName(version));
