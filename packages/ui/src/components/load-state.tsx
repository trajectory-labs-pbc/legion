import type { ReactNode } from "react";
import { Button } from "#registry/legion/ui/button";

interface LoadStateProps {
  /** The read has not answered yet. */
  pending: boolean;
  /** The read failed. */
  failed: boolean;
  /** What to say while it is out: `Loading machine logins…`. */
  loading: ReactNode;
  /** What to say when it failed: `Couldn't load machine logins.` */
  failure: ReactNode;
  onRetry: () => void;
  /** A retry is out, so the button waits. */
  retrying?: boolean;
  /** Drawn once the read has answered. */
  children: ReactNode;
}

/** What a read shows in place of its content: a line while it loads, or its failure with a Retry. */
function LoadState({
  pending,
  failed,
  loading,
  failure,
  onRetry,
  retrying = false,
  children,
}: LoadStateProps) {
  if (pending) {
    return (
      <p data-slot="load-state" data-state="loading" className="text-sm text-muted-foreground">
        {loading}
      </p>
    );
  }
  if (failed) {
    return (
      <div
        data-slot="load-state"
        data-state="failed"
        role="alert"
        className="flex items-center gap-3 border bg-card p-3 text-sm text-card-foreground"
      >
        <span className="text-danger">{failure}</span>
        <Button disabled={retrying} onClick={onRetry} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    );
  }
  return children;
}

export { LoadState, type LoadStateProps };
