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

/** One chip per step: `["⌘K"]` for a key press, `["G", "I"]` for a two-key sequence. */
function KbdSequence({ chips, className }: { chips: readonly string[]; className?: string }) {
  if (chips.length === 0) return null;
  if (chips.length === 1) return <Kbd className={className}>{chips[0]}</Kbd>;
  return (
    <span data-slot="kbd-sequence" className={cn("inline-flex items-center gap-0.5", className)}>
      {chips.map((chip, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a chip can repeat, so its place is its identity
        <Kbd key={index}>{chip}</Kbd>
      ))}
    </span>
  );
}

export { Kbd, KbdSequence };
