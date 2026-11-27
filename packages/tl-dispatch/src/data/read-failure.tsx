import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { type ReadFault, type Refusal, refusalOf } from "@/data/read";
import { useFocusHandOff } from "@/upstream/data-hooks";

/** How a read with nothing to show last failed, as the component reading it saw. */
type Failure = Refusal | "retryable";

/** A failure this component saw, with the time of the read's error it came from. */
type Seen = { readonly failure: Failure; readonly at: number };

/** What a failure reads of a read: a query result, or a query's state with its Retry. */
type FailableRead = Pick<
  UseQueryResult<unknown>,
  "data" | "error" | "errorUpdatedAt" | "fetchStatus" | "isPlaceholderData"
> & { refetch: () => unknown };

/**
 * The reads that failed with nothing to show, if any; the failure stays while their Retry runs.
 * A refetch clears the error of a read with no data until it answers, so a read keeps the failure
 * this component saw while it is out again, however often it failed meanwhile. A read this
 * component never saw fail is loading while it is out, so a failure from before it mounted shows
 * only once the read answers again. Every render passes the same reads in the same places,
 * `undefined` for a read left out: what was seen is kept by place, and only while the read's last
 * error is not older than the one it was seen with, so another query at the same place starts
 * afresh. Another key's placeholder is nothing of the read's own to show.
 */
export function useReadFailure(
  ...reads: readonly (FailableRead | undefined)[]
): ReadFault | undefined {
  const [seen, setSeen] = useState<readonly (Seen | undefined)[]>([]);
  const current = reads.map((read, index): Seen | undefined => {
    if (read === undefined || (read.data !== undefined && !read.isPlaceholderData)) {
      return undefined;
    }
    const at = read.errorUpdatedAt;
    if (read.error !== null) return { at, failure: refusalOf(read.error) ?? "retryable" };
    const last = seen[index];
    return read.fetchStatus === "idle" || last === undefined || at < last.at ? undefined : last;
  });
  const changed = current.some(
    (each, index) => each?.failure !== seen[index]?.failure || each?.at !== seen[index]?.at
  );
  if (changed) setSeen(current);
  const failures = current.map((each) => each?.failure);
  if (failures.every((failure) => failure === undefined)) return undefined;
  const retrying = reads.some(
    (read, index) => failures[index] !== undefined && read?.fetchStatus !== "idle"
  );
  if (!failures.includes("retryable")) {
    return { refusal: failures.includes("forbidden") ? "forbidden" : "not-found", retrying };
  }
  // A failure that trying again can clear wins, so its Retry shows.
  return {
    retrying,
    // Every read is asked again, so what they make together comes from one round.
    retry: () => {
      for (const read of reads) void read?.refetch();
    },
  };
}

/** A read whose refresh failed under what it shows, if so; the failure stays while its Retry runs. */
export function refreshFailureOf(read: UseQueryResult<unknown>): ReadFault | undefined {
  if (!read.isRefetchError) return undefined;
  const refusal = refusalOf(read.error);
  if (refusal !== undefined) {
    return { refusal, retrying: read.fetchStatus !== "idle", refresh: true };
  }
  return {
    retrying: read.fetchStatus !== "idle",
    retry: () => void read.refetch(),
    refresh: true,
  };
}

/** What a failed read says of `noun`. */
export function lineOf(fault: ReadFault, noun: string): string {
  if (fault.refresh === true) {
    if (fault.refusal === undefined) return `Could not refresh ${noun}.`;
    return `Could not refresh ${noun}: ${fault.refusal === "forbidden" ? "access refused" : "not found"}.`;
  }
  if (fault.refusal === undefined) return `Could not load ${noun}.`;
  return fault.refusal === "forbidden" ? `You cannot see ${noun}.` : `Could not find ${noun}.`;
}

/**
 * A failed read, announced: Retry, which keeps the focus while it runs, or no Retry for a refusal.
 * A refusal that answers a Retry takes the focus the Retry had.
 */
export function ReadFailure({
  fault,
  noun,
  size = "compact",
}: {
  fault: ReadFault;
  noun: string;
  /** `default` where the failure stands for a whole page. */
  size?: "default" | "compact";
}) {
  const box = useRef<HTMLDivElement>(null);
  const retry = useFocusHandOff(() => box.current);
  const refused = fault.refusal !== undefined;
  return (
    <Alert
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      ref={box}
      size={size}
      tabIndex={refused ? -1 : undefined}
      variant="danger"
    >
      <AlertTitle>{lineOf(fault, noun)}</AlertTitle>
      {refused ? null : (
        <AlertAction>
          <Button
            loading={fault.retrying}
            onClick={fault.retry}
            ref={retry}
            size={size === "compact" ? "xs" : "sm"}
            variant="outline"
          >
            Retry
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
