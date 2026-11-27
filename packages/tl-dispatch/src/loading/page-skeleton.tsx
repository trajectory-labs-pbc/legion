import { Skeleton } from "@legion/ui/components/skeleton";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useContext,
  useEffect,
  useState,
} from "react";

const ROWS = [0, 1, 2, 3];

/** How long a wait may take before its skeleton shows, so a quick one draws none. */
const SKELETON_DELAY_MS = 200;
/** How long a skeleton stays once shown, so it never flashes. */
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
      const left = Math.max(0, shownAt + SKELETON_HOLD_MS - Date.now());
      const timer = setTimeout(() => setShownAt(undefined), left);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [waiting, shownAt]);
  return shownAt !== undefined;
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

/** Hands a boundary the hold its fallback's skeleton started. */
const HoldContext = createContext<((hold: Promise<void>) => void) | undefined>(undefined);

/** Suspends while the hold of a shown skeleton runs, so the page behind it waits it out. */
function WaitOut({ hold }: { hold: Promise<void> | undefined }): null {
  if (hold !== undefined) use(hold);
  return null;
}

/** A Suspense boundary whose page skeleton, once shown, stays its 300 ms though the page came. */
export function PageSuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}): ReactNode {
  const [hold, setHold] = useState<Promise<void>>();
  return (
    <Suspense fallback={<HoldContext value={setHold}>{fallback}</HoldContext>}>
      <WaitOut hold={hold} />
      {children}
    </Suspense>
  );
}

/** What shows while a page that is not an issue's loads, after a moment. */
export function PageFallback(): ReactNode {
  const shown = useSkeleton(true);
  const startHold = useContext(HoldContext);
  useEffect(() => {
    if (shown) startHold?.(new Promise((done) => setTimeout(done, SKELETON_HOLD_MS)));
  }, [shown, startHold]);
  return shown ? <PageSkeleton label="Loading the page" /> : null;
}
