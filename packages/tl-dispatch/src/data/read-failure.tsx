import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import { hashKey, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";

import { type ReadFault, type Refusal, refusalOf } from "@/data/read";
import { queryRetry } from "@/upstream/api";

/** Every read's retry policy: upstream's, except that it never asks a refused read again by itself. */
export function readRetry(failureCount: number, error: unknown): boolean {
  return refusalOf(error) === undefined && queryRetry(failureCount, error);
}

/** A read, and the key of the query it reads. */
export type KeyedRead = { read: UseQueryResult<unknown>; key: QueryKey };

/** How a read with nothing to show last failed, as the component reading it saw. */
type Failure = Refusal | "retryable";

/** A failure seen, and the hash of the query it came from. */
type Seen = { query: string | undefined; failure: Failure | undefined };

/**
 * The reads that failed with nothing to show, if any; the failure stays while their Retry runs.
 * A refetch clears the error of a read with no data until it answers, so a read keeps the failure
 * this component saw while the same query is out again, however often it failed meanwhile. A read
 * this component never saw fail is loading while it is out, so a failure from before it mounted,
 * or another query's, shows only once the read answers again. Every render passes the same reads
 * in the same places, `undefined` for a read left out: what was seen is kept by place.
 */
export function useReadFailure(
  ...reads: readonly (KeyedRead | undefined)[]
): ReadFault | undefined {
  const [seen, setSeen] = useState<readonly Seen[]>([]);
  const now = reads.map((slot, index): Seen => {
    if (slot === undefined) return { query: undefined, failure: undefined };
    const { read } = slot;
    const query = hashKey(slot.key);
    if (read.data !== undefined) return { query, failure: undefined };
    if (read.error !== null) return { query, failure: refusalOf(read.error) ?? "retryable" };
    const last = seen[index];
    const again = read.fetchStatus !== "idle" && last?.query === query;
    return { query, failure: again ? last.failure : undefined };
  });
  const changed = now.some(
    (each, index) => each.query !== seen[index]?.query || each.failure !== seen[index]?.failure
  );
  if (now.length !== seen.length || changed) setSeen(now);
  const failures = now.map((each) => each.failure);
  if (failures.every((failure) => failure === undefined)) return undefined;
  const retrying = reads.some(
    (slot, index) => failures[index] !== undefined && slot?.read.fetchStatus !== "idle"
  );
  if (!failures.includes("retryable")) {
    return { refusal: failures.includes("forbidden") ? "forbidden" : "not-found", retrying };
  }
  // A failure that trying again can clear wins, so its Retry shows.
  return {
    retrying,
    // Every read is asked again, so what they make together comes from one round.
    retry: () => {
      for (const slot of reads) void slot?.read.refetch();
    },
  };
}

/** A read whose refresh failed under what it shows, if so; the failure stays while its Retry runs. */
export function refreshFailureOf(read: UseQueryResult<unknown>): ReadFault | undefined {
  if (!read.isRefetchError) return undefined;
  const refusal = refusalOf(read.error);
  if (refusal !== undefined) return { refusal, retrying: read.fetchStatus !== "idle" };
  return { retrying: read.fetchStatus !== "idle", retry: () => void read.refetch() };
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
