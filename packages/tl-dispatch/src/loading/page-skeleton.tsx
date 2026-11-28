import { Skeleton } from "@legion/ui/components/skeleton";
import { type ReactNode, useEffect, useState } from "react";

const ROWS = [0, 1, 2, 3];

/** How long a page may take before its skeleton shows, so a quick one draws none. */
const SKELETON_DELAY_MS = 200;

/** Whether a view that is still loading may draw its skeleton yet (rule ES4). */
export function useSkeletonDue(): boolean {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAfter(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return after;
}

/** A page that is not an issue's, as boxes: a title and list rows. */
export function PageSkeleton({ label }: { label: string }): ReactNode {
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

/** What shows while a page that is not an issue's loads, after a moment. */
export function PageFallback(): ReactNode {
  return useSkeletonDue() ? <PageSkeleton label="Loading the page" /> : null;
}
