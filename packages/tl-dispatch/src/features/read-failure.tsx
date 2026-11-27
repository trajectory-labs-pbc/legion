import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";

/** Reads that failed with nothing to show, and their Retry. */
export interface ReadFault {
  /** Their Retry is out: the failure stays, and its Retry shows it is busy. */
  retrying: boolean;
  retry: () => void;
}

/** The reads that failed with nothing to show, if any; the failure stays while their Retry runs. */
export function readFailureOf(...reads: readonly UseQueryResult<unknown>[]): ReadFault | undefined {
  // A Retry puts a read back to pending, so the error count is what says it failed before.
  const failed = reads.filter((read) => read.data === undefined && read.errorUpdateCount > 0);
  if (failed.length === 0) return undefined;
  return {
    retrying: failed.some((read) => read.isFetching),
    // Every read is asked again, so what they make together comes from one round.
    retry: () => {
      for (const read of reads) void read.refetch();
    },
  };
}

/** A read whose refresh failed under what it shows, if so; the failure stays while its Retry runs. */
export function refreshFailureOf(read: UseQueryResult<unknown>): ReadFault | undefined {
  if (!read.isRefetchError) return undefined;
  return { retrying: read.isFetching, retry: () => void read.refetch() };
}

/** A failed read, announced, with a Retry that keeps the focus while it runs. */
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
  return (
    <Alert size={size} variant="danger">
      <AlertTitle>Could not load {noun}.</AlertTitle>
      <AlertAction>
        <Button
          loading={fault.retrying}
          onClick={fault.retry}
          size={size === "compact" ? "xs" : "sm"}
          variant="outline"
        >
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );
}
