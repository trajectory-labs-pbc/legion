import type { DocumentRead, ReadMarkListener } from "@/data/read-marks";

/** What the aids keep of one document for the visit: from its first show in this tab to a reload. */
export interface Visit {
  /** The first answer of upstream's read-mark read in the visit, before upstream's write moves it. */
  readMark?: { readonly answer: DocumentRead };
}

const visits = new Map<string, Visit>();

/** The visit of the document `artifactId`, made at its first call. */
export function visitOf(artifactId: string): Visit {
  let visit = visits.get(artifactId);
  if (visit === undefined) {
    visit = {};
    visits.set(artifactId, visit);
  }
  return visit;
}

/** Each document's first read-mark answer goes in its visit; every visit is forgotten when the
 *  person goes: at each sign-out upstream tells of, and when another person signs in after a lapse. */
export const visitReadMarks: ReadMarkListener = {
  answer: (artifactId, answer) => {
    visitOf(artifactId).readMark ??= { answer };
  },
  leave: () => visits.clear(),
};
