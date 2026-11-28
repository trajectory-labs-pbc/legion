import type { ReactNode } from "react";

/** Where a read is: under way, failed, done with nothing, or done with something to show. */
type ReadState = "loading" | "failed" | "empty" | "ready";

/** Draws the one part of a view that its read's state calls for. */
function ReadBoundary({
  state,
  loading,
  failed,
  empty,
  children,
}: {
  state: ReadState;
  loading: ReactNode;
  failed: ReactNode;
  empty: ReactNode;
  children: ReactNode;
}) {
  const shown = { loading, failed, empty, ready: children }[state];
  return (
    <div className="contents" data-slot="read-boundary" data-state={state}>
      {shown}
    </div>
  );
}

export { ReadBoundary, type ReadState };
