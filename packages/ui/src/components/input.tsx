import { cn } from "cn";
import type { ComponentProps } from "react";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-field px-2.5 py-1 text-base md:text-sm",
        "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
