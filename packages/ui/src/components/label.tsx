import { cn } from "cn";
import type { ComponentProps } from "react";

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes htmlFor or the control
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-disabled",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-disabled peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-disabled",
        className
      )}
      {...props}
    />
  );
}

export { Label };
