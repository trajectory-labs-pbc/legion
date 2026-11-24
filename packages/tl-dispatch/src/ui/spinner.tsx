import { LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/ui/lib/utils";

function Spinner({ className, "aria-label": ariaLabel = "Loading", ...props }: ComponentProps<"svg">) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      role="status"
      aria-label={ariaLabel}
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Spinner };
