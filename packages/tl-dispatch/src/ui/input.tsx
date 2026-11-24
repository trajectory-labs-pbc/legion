import type { ComponentProps } from "react";

import { cn } from "@/ui/lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-field px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
        "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
