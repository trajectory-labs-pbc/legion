import { cn } from "cn";
import type { ComponentProps } from "react";

/** A 16-unit drawing at a row's glyph size, as an image named by `label`: the frame each glyph
 *  draws in. */
function Glyph({
  className,
  label,
  ...props
}: Omit<ComponentProps<"svg">, "aria-label" | "role" | "viewBox"> & { label: string }) {
  return (
    <svg
      aria-label={label}
      data-slot="glyph"
      role="img"
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", className)}
      {...props}
    />
  );
}

export { Glyph };
