import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";

import { type ReadFault, type Refusal, refusalOf } from "@/data/read";
import { queryRetry } from "@/upstream/api";

/** Every read's retry policy: upstream's, which never asks a refused read again by itself. */
export function readRetry(failureCount: number, error: unknown): boolean {
  return refusalOf(error) === undefined && queryRetry(failureCount, error);
}

/** `reads` that failed with nothing to show, each with its refusal, if any. */
function faultOf(
  reads: readonly UseQueryResult<unknown>[],
  refusals: readonly (Refusal | undefined)[]
): ReadFault | undefined {
  // A Retry puts a read back to pending, so the error count is what says it failed before.
  const failed = reads.flatMap((read, index) =>
    read.data === undefined && read.errorUpdateCount > 0 ? [index] : []
  );
  if (failed.length === 0) return undefined;
  const retrying = failed.some((index) => reads[index]?.isFetching === true);
  const refused = failed.map((index) => refusals[index]);
  if (!refused.includes(undefined)) {
    return { refusal: refused.includes("forbidden") ? "forbidden" : "not-found", retrying };
  }
  // A failure that trying again can clear wins, so its Retry shows.
  return {
    retrying,
    // Every read is asked again, so what they make together comes from one round.
    retry: () => {
      for (const read of reads) void read.refetch();
    },
  };
}

/**
 * The reads that failed with nothing to show, if any; the failure stays while their Retry runs.
 * A refetch clears the error of a read with no data until it answers, so a refused read keeps its
 * last refusal while it is asked again.
 */
export function useReadFailure(
  ...reads: readonly UseQueryResult<unknown>[]
): ReadFault | undefined {
  const [kept, setKept] = useState<readonly (Refusal | undefined)[]>([]);
  const refusals = reads.map((read, index) => {
    if (read.error !== null) return refusalOf(read.error);
    return read.data === undefined && read.isFetching ? kept[index] : undefined;
  });
  if (refusals.length !== kept.length || refusals.some((each, index) => each !== kept[index])) {
    setKept(refusals);
  }
  return faultOf(reads, refusals);
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
