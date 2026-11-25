import { cn } from "cn";
import type { ComponentProps } from "react";

function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 items-center gap-0.5 rounded-sm border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  );
}

/** A cap, or the muted "then" between a sequence's steps where `cap` is null. */
function KbdPart({ cap }: { cap: string | null }) {
  return cap === null ? (
    <span className="px-0.5 text-xs text-muted-foreground">then</span>
  ) : (
    <Kbd>{cap}</Kbd>
  );
}

/** A key in steps, one cap per key: a combination's caps sit together (`[["⌘", "K"]]`), and a
 *  sequence puts a muted "then" between its steps (`[["G"], ["I"]]`). */
function KbdSequence({
  className,
  steps,
}: {
  className?: string;
  steps: readonly (readonly string[])[];
}) {
  const parts = steps.flatMap((step, index): (string | null)[] =>
    index === 0 ? [...step] : [null, ...step]
  );
  if (parts.length === 0) return null;
  return (
    <span data-slot="kbd-sequence" className={cn("inline-flex items-center gap-0.5", className)}>
      {parts.map((cap, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a cap can repeat, so its place is its identity
        <KbdPart cap={cap} key={index} />
      ))}
    </span>
  );
}

export { Kbd, KbdSequence };
