import type {
  MarginDrawer,
  MarginDrawerPage,
} from "@upstream-dispatch/features/issue-page/margin-slot";
import { useMemo, useState } from "react";

/**
 * The issue frame's Details drawer, open for one issue: opening another issue closes it. None
 * outside the issue frame.
 */
export function useDetailsDrawer(
  issueFrame: boolean,
  issueKey: string | undefined
): MarginDrawer | undefined {
  const [openFor, setOpenFor] = useState<string | undefined>(undefined);
  if (openFor !== undefined && openFor !== issueKey) setOpenFor(undefined);
  const [page, setPage] = useState<MarginDrawerPage | undefined>(undefined);
  return useMemo(
    () =>
      issueFrame
        ? {
            open: openFor !== undefined && openFor === issueKey,
            page,
            setOpen: (open: boolean) => setOpenFor(open ? issueKey : undefined),
            setPage,
          }
        : undefined,
    [issueFrame, issueKey, openFor, page]
  );
}
