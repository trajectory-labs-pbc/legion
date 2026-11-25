import { Button } from "@legion/ui/components/button";
import { useEffect, useState } from "react";

/** How long a read may take before its loading line shows, so a quick one draws none (ES4). */
const LOADING_DELAY_MS = 200;

/** Whether `ms` have passed since the caller mounted. */
function useAfter(ms: number): boolean {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAfter(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return after;
}

/** A read with nothing to show yet: a quiet loading line after a moment, or the failure and Retry. */
export function ReadLine({ noun, retry }: { noun: string; retry: (() => void) | undefined }) {
  const late = useAfter(LOADING_DELAY_MS);
  if (retry === undefined) {
    return late ? <p className="px-2 py-1 text-xs text-muted-foreground">Loading {noun}…</p> : null;
  }
  return (
    <p className="flex items-center gap-1 py-0.5 pl-2 text-xs text-danger">
      <span className="min-w-0 flex-1">Could not load {noun}.</span>
      <Button onClick={retry} size="xs" variant="link">
        Retry
      </Button>
    </p>
  );
}
