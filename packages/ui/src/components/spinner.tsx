import { cn } from "cn";
import { LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

function Spinner({
  className,
  "aria-label": ariaLabel = "Loading",
  ...props
}: ComponentProps<"svg">) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      role="status"
      aria-label={ariaLabel}
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
