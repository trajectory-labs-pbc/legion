import { Skeleton } from "@legion/ui/components/skeleton";
import { type ReactNode, useEffect, useState } from "react";

const ROWS = [0, 1, 2, 3];

/** How long a wait may take before its skeleton shows, so a quick one draws none. */
const SKELETON_DELAY_MS = 200;
/** The least time a skeleton stays once shown, so it does not flash. */
const SKELETON_HOLD_MS = 300;

/**
 * Whether a wait shows its skeleton: once `waiting` has lasted 200 ms, and from then on until the
 * wait ends or 300 ms have passed, whichever comes last.
 */
export function useSkeleton(waiting: boolean): boolean {
  const [shownAt, setShownAt] = useState<number>();
  useEffect(() => {
    if (waiting && shownAt === undefined) {
      const timer = setTimeout(() => setShownAt(Date.now()), SKELETON_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!waiting && shownAt !== undefined) {
      // Capped, so a clock set back cannot hold the skeleton longer.
      const left = Math.min(SKELETON_HOLD_MS, Math.max(0, shownAt + SKELETON_HOLD_MS - Date.now()));
      const timer = setTimeout(() => setShownAt(undefined), left);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [waiting, shownAt]);
  return shownAt !== undefined;
}

/** A page that is not an issue's, as boxes: a title and list rows. */
export function PageSkeleton({ label = "Loading the page" }: { label?: string }): ReactNode {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <Skeleton className="h-control-sm w-1/3" />
      <div className="mt-6 space-y-1">
        {ROWS.map((row) => (
          <Skeleton className="h-9 w-full" key={row} />
        ))}
      </div>
    </div>
  );
}

/**
 * What the page outlet shows while a page's code loads, after a moment. React itself reveals the
 * page no sooner than about 290 ms after this fallback committed: its throttle is 300 ms and it
 * commits at once when 10 ms or less remain.
 */
export function PageFallback(): ReactNode {
  return useSkeleton(true) ? <PageSkeleton /> : null;
}
