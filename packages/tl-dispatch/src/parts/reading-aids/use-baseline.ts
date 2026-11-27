import { useCallback, useMemo } from "react";

import {
  type AidedDocument,
  useAsksRead,
  useBaselineVersionRead,
  useReadMarkFault,
  type Version,
} from "@/data/document-reads";
import type { ReadFault } from "@/data/read";
import { useReadFailure } from "@/data/read-failure";
import type { ChangeBaseline } from "@/upstream/editor/engine";

import { type BaselineChoice, baselineOf, textChangedSince, type Unavailable } from "./baseline";
import { chooseVersion, fixBaseline, useVisit } from "./visit";

/** The baseline the marks compare with, from the first state a visit shows to the read text. */
export type Baseline =
  | { readonly state: "loading" }
  | { readonly state: "failed"; readonly fault: ReadFault }
  | { readonly state: "none" }
  | { readonly state: "unavailable"; readonly version: number; readonly why: Unavailable }
  | {
      readonly state: "ready";
      readonly choice: BaselineChoice;
      readonly baseline: ChangeBaseline;
    };

export interface BaselineRead {
  /** A ready baseline's identity changes only when the baseline does: a new choice or its text. */
  readonly baseline: Baseline;
  /** The version the open request named, when the document changed since. */
  readonly changedSince: number | undefined;
  /** Which of upstream's version pickers the page shows, whose names Compare with takes. */
  readonly picker: AidedDocument["picker"];
  /** The versions "Compare with" offers, newest first. */
  readonly versions: readonly Version[];
  /** The version "Compare with" shows: the reader's pick, else the visit's baseline. */
  readonly version: number | undefined;
  /** Picks `version` under "Compare with", for the visit. */
  readonly compareWith: (version: number) => void;
}

const LOADING: Baseline = { state: "loading" };
const NONE: Baseline = { state: "none" };

const pendingOr = (fault: ReadFault | undefined): Baseline =>
  fault === undefined ? LOADING : { fault, state: "failed" };

/**
 * The document's baseline for the visit: fixed at the first good asks answer, and on an issue's
 * spec once upstream's read-mark read has answered; the reader's pick replaces it.
 */
export function useBaseline(document: AidedDocument): BaselineRead {
  const { artifactId } = document;
  const visit = useVisit(artifactId);
  const asks = useAsksRead(document);
  const mark = useReadMarkFault(artifactId);
  const refused = mark?.refusal !== undefined;
  const markFault = refused ? undefined : mark;
  // The read mark matters only when no request gives the baseline; a refused one is none.
  const settled =
    asks.data !== undefined &&
    (!document.readsMark ||
      visit.readMark !== undefined ||
      refused ||
      baselineOf(asks.data, artifactId, null) !== null);
  const fixed = settled
    ? fixBaseline(
        artifactId,
        baselineOf(asks.data, artifactId, visit.readMark?.answer.version ?? null)
      )
    : visit.baseline;

  const compareWith = useCallback(
    (version: number) => chooseVersion(artifactId, version),
    [artifactId]
  );
  const version = visit.compareWith ?? fixed?.version;
  const versionRead = useBaselineVersionRead(artifactId, version);
  const versionFault = useReadFailure(versionRead);
  const asksFault = useReadFailure(asks);
  const shown = version === undefined ? undefined : versionRead.data;
  const fixedKind = fixed?.kind;
  const fixedVersion = fixed?.version;
  const ready = useMemo((): Baseline | undefined => {
    if (shown?.text === undefined) return undefined;
    const kind = fixedKind !== undefined && shown.version === fixedVersion ? fixedKind : "chosen";
    return {
      baseline: shown.text,
      choice: { kind, version: shown.version },
      state: "ready",
    };
  }, [fixedKind, fixedVersion, shown]);

  function baselineNow(): Baseline {
    if (version !== undefined) {
      // A failed version shows its failure while its Retry runs, over the last version's text.
      if (versionFault?.refusal !== undefined) {
        return { state: "unavailable", version, why: versionFault.refusal };
      }
      if (versionFault !== undefined) return { fault: versionFault, state: "failed" };
      if (ready !== undefined) return ready;
      if (shown !== undefined && !versionRead.isPlaceholderData) {
        return { state: "unavailable", version: shown.version, why: "file" };
      }
      return LOADING;
    }
    if (fixed === null) return NONE;
    return pendingOr(asksFault ?? (document.readsMark ? markFault : undefined));
  }

  return {
    baseline: baselineNow(),
    changedSince: asks.data === undefined ? undefined : textChangedSince(asks.data, artifactId),
    compareWith,
    picker: document.picker,
    version,
    versions: document.versions,
  };
}
