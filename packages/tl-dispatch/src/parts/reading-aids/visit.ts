import { useSyncExternalStore } from "react";
import type { DocumentRead, ReadMarkListener } from "@/data/read-marks";

import type { BaselineChoice } from "./baseline";

/** What the aids keep of one document for the visit: from its first show in this tab to a reload. */
export interface Visit {
  /** The first answer of upstream's read-mark read in the visit, before upstream's write moves it. */
  readonly readMark?: { readonly answer: DocumentRead };
  /** The baseline the first settled answers fixed; null when they found none. */
  baseline?: BaselineChoice | null;
  /** The version the reader picked under "Compare with". */
  readonly compareWith?: number;
}

const visits = new Map<string, Visit>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** The visit of the document `artifactId`, made at its first call. */
export function visitOf(artifactId: string): Visit {
  let visit = visits.get(artifactId);
  if (visit === undefined) {
    visit = {};
    visits.set(artifactId, visit);
  }
  return visit;
}

/** The visit of `artifactId`, drawn again at each change of it. */
export const useVisit = (artifactId: string): Visit =>
  useSyncExternalStore(subscribe, () => visitOf(artifactId));

function update(artifactId: string, change: Partial<Visit>): void {
  visits.set(artifactId, { ...visitOf(artifactId), ...change });
  notify();
}

function forget(): void {
  visits.clear();
  notify();
}

/** Keeps the reader's "Compare with" pick of the document for the visit. */
export const chooseVersion = (artifactId: string, version: number) =>
  update(artifactId, { compareWith: version });

/** The visit's baseline: `choice` when none is fixed yet, which then stays for the visit. */
export function fixBaseline(artifactId: string, choice: BaselineChoice | null) {
  const visit = visitOf(artifactId);
  // Set in place while drawing, as a lazy ref is: every reader would fix the same choice.
  if (visit.baseline === undefined) visit.baseline = choice;
  return visit.baseline;
}

/** Each document's first read-mark answer goes in its visit; every visit is forgotten when the
 *  person goes: at each sign-out upstream tells of, and when another person signs in after a lapse. */
export const visitReadMarks: ReadMarkListener = {
  answer: (artifactId, answer) => {
    if (visitOf(artifactId).readMark === undefined) update(artifactId, { readMark: { answer } });
  },
  leave: forget,
};
