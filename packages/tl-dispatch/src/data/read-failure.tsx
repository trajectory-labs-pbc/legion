import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";

import { type ReadFault, type Refusal, refusalOf } from "@/data/read";
import { queryRetry } from "@/upstream/api";

/** Every read's retry policy: upstream's, except that it never asks a refused read again by itself. */
export function readRetry(failureCount: number, error: unknown): boolean {
  return refusalOf(error) === undefined && queryRetry(failureCount, error);
}

/** What a fault reads of a read. */
type FailableRead = Pick<
  UseQueryResult<unknown>,
  "data" | "error" | "errorUpdatedAt" | "fetchStatus" | "isFetching"
> & { refetch: () => unknown };

/** How a read with nothing to show last failed, as the component reading it saw. */
type Failure = Refusal | "retryable";

/** A failure seen, with the time of the error it came from, which names its query. */
type Seen = { at: number; failure: Failure | undefined };

/**
 * The reads that failed with nothing to show, if any; the failure stays while their Retry runs.
 * A refetch clears the error of a read with no data until it answers, so a read keeps the failure
 * this component saw while the same query, known by its last error's time, is asked again. A read
 * this component never saw fail is loading while it is out, so a failure from before it mounted,
 * or another query's, shows only once the read answers again. Every render passes the same reads
 * in the same places, `undefined` for a read left out: what was seen is kept by place.
 */
export function useReadFailure(
  ...reads: readonly (FailableRead | undefined)[]
): ReadFault | undefined {
  const [seen, setSeen] = useState<readonly Seen[]>([]);
  const now = reads.map((read, index): Seen => {
    const at = read?.errorUpdatedAt ?? 0;
    if (read === undefined || read.data !== undefined) return { at, failure: undefined };
    if (read.error !== null) return { at, failure: refusalOf(read.error) ?? "retryable" };
    const last = seen[index];
    const again = read.fetchStatus !== "idle" && last?.at === at;
    return { at, failure: again ? last.failure : undefined };
  });
  const changed = now.some(
    (each, index) => each.at !== seen[index]?.at || each.failure !== seen[index]?.failure
  );
  if (now.length !== seen.length || changed) setSeen(now);
  const failures = now.map((each) => each.failure);
  if (failures.every((failure) => failure === undefined)) return undefined;
  const retrying = reads.some(
    (read, index) => failures[index] !== undefined && read?.isFetching === true
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
  if (refusal !== undefined) return { refusal, retrying: read.isFetching };
  return { retrying: read.isFetching, retry: () => void read.refetch() };
}

function lineOf(fault: ReadFault, noun: string, refresh: boolean): string {
  if (refresh) {
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
  refresh = false,
  size = "compact",
}: {
  fault: ReadFault;
  noun: string;
  /** The read failed under rows it still shows. */
  refresh?: boolean;
  /** `default` where the failure stands for a whole page. */
  size?: "default" | "compact";
}) {
  const alert = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const retryHadFocus = useRef(false);
  const refused = fault.refusal !== undefined;
  useLayoutEffect(() => {
    const active = document.activeElement;
    const lost = active === null || active === document.body || !active.isConnected;
    if (refused && retryHadFocus.current && lost) alert.current?.focus();
    retryHadFocus.current = !refused && document.activeElement === retry.current;
  });
  return (
    <Alert
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      ref={alert}
      size={size}
      tabIndex={refused ? -1 : undefined}
      variant="danger"
    >
      <AlertTitle>{lineOf(fault, noun, refresh)}</AlertTitle>
      {fault.refusal === undefined ? (
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
      ) : null}
    </Alert>
  );
}
