import { cn } from "cn";
import type { ComponentProps } from "react";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-field px-2.5 py-1.5 text-base placeholder:text-muted-foreground md:text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-disabled",
        "aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
