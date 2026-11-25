import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

/** A record's facts, as a description list: one column, two from `sm`. */
function FactList({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      data-slot="fact-list"
      className={cn("grid grid-cols-1 gap-3 text-sm sm:grid-cols-2", className)}
      {...props}
    />
  );
}

/** One fact: its label, then its value, which wraps anywhere. */
function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="fact" className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-anywhere">{children}</dd>
    </div>
  );
}

export { Fact, FactList };
