import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { type ReadFault, type Refusal, refusalOf } from "@/data/read";
import { useFocusHandOff } from "@/upstream/data-hooks";

/** How a read with nothing to show last failed, as the component reading it saw. */
type Failure = Refusal | "retryable";

/**
 * The reads that failed with nothing to show, if any; the failure stays while their Retry runs.
 * A refetch clears the error of a read with no data until it answers, so a read keeps the failure
 * this component saw while it is out again, however often it failed meanwhile. A read this
 * component never saw fail is loading while it is out, so a failure from before it mounted shows
 * only once the read answers again. Every render passes the same reads in the same places, each
 * place always the same query, `undefined` for a read left out: what was seen is kept by place.
 */
export function useReadFailure(
  ...reads: readonly (UseQueryResult<unknown> | undefined)[]
): ReadFault | undefined {
  const [seen, setSeen] = useState<readonly (Failure | undefined)[]>([]);
  const failures = reads.map((read, index): Failure | undefined => {
    if (read === undefined || read.data !== undefined) return undefined;
    if (read.error !== null) return refusalOf(read.error) ?? "retryable";
    return read.fetchStatus === "idle" ? undefined : seen[index];
  });
  if (failures.some((failure, index) => failure !== seen[index])) setSeen(failures);
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
  const alert = useRef<HTMLDivElement>(null);
  const retry = useFocusHandOff(() => alert.current);
  const refused = fault.refusal !== undefined;
  return (
    <Alert
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      ref={alert}
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
