import { ReadBoundary } from "@legion/ui/blocks/read-boundary";
import { ErrorState, LoadingState } from "@legion/ui/blocks/states";
import { Button } from "@legion/ui/components/button";
import { Skeleton } from "@legion/ui/components/skeleton";
import { isDrawn } from "@legion/ui/lib/utils";
import type { ReactNode } from "react";

import type { Read, ReadFault } from "@/data/read";
import { useSkeletonDue } from "@/loading/page-skeleton";

const ROWS = [0, 1, 2, 3, 4, 5];

/** The list while it loads: nothing for a moment, then still two-line rows (INB-28). */
function InboxLoading(): ReactNode {
  if (!useSkeletonDue()) return null;
  return (
    <LoadingState label="Loading your inbox">
      {ROWS.map((row) => (
        <div className="flex h-list-row-2 flex-col justify-center gap-2 px-4" key={row}>
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </LoadingState>
  );
}

/** The list's failed read, announced, with its Retry when another read can help (INB-29). */
function InboxFailed({ fault }: { fault: ReadFault }): ReactNode {
  return (
    <ErrorState
      action={
        fault.retry === undefined ? undefined : (
          <Button loading={fault.retrying} onClick={fault.retry} size="sm" variant="outline">
            Retry
          </Button>
        )
      }
      description="Dispatch did not send the list."
      title="Could not load your inbox."
    />
  );
}

/**
 * The list's part for its read: loading, failed, `empty` when it draws something, else the rows.
 * No `empty` is a list with rows, or one that does not say it is empty (INB-34).
 */
export function InboxListBoundary({
  read,
  empty,
  children,
}: {
  read: Read<unknown>;
  empty?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const state =
    read.state === "loading"
      ? "loading"
      : read.state === "error"
        ? "failed"
        : isDrawn(empty)
          ? "empty"
          : "ready";
  return (
    <ReadBoundary
      empty={empty}
      failed={read.state === "error" ? <InboxFailed fault={read} /> : null}
      loading={<InboxLoading />}
      state={state}
    >
      {children}
    </ReadBoundary>
  );
}
