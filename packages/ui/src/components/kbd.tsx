import { cn } from "cn";
import { type ComponentProps, Fragment } from "react";

import { textVariants } from "#registry/legion/lib/typography";

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

/** A key in steps, one cap per key: a combination's caps sit together (`[["⌘", "K"]]`), and a
 *  sequence puts a muted "then" between its steps (`[["G"], ["I"]]`). */
function KbdSequence({
  className,
  steps,
}: {
  className?: string;
  steps: readonly (readonly string[])[];
}) {
  if (steps.length === 0) return null;
  return (
    <span data-slot="kbd-sequence" className={cn("inline-flex items-center gap-0.5", className)}>
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a step can repeat, so its place is its identity
        <Fragment key={index}>
          {index === 0 ? null : (
            <span className={cn(textVariants({ size: "caption", tone: "muted" }), "px-0.5")}>
              then
            </span>
          )}
          {/* A combination never holds one key twice. */}
          {step.map((cap) => (
            <Kbd key={cap}>{cap}</Kbd>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

export { Kbd, KbdSequence };
