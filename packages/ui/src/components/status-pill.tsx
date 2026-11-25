import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const statusPillVariants = cva(
  "flex w-fit items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        danger: "border-danger-border bg-danger-tint text-danger",
        warning: "border-warning-border bg-warning-tint text-warning",
        success: "border-success-border bg-success-tint text-success",
      },
    },
  }
);

type StatusPillProps = ComponentProps<"p"> &
  Required<Pick<VariantProps<typeof statusPillVariants>, "tone">>;

/** A line that reports a state of the page as it changes; a screen reader hears it when it does. */
function StatusPill({ className, tone, ...props }: StatusPillProps) {
  return (
    <p
      data-slot="status-pill"
      data-tone={tone}
      aria-live="polite"
      className={cn(statusPillVariants({ tone }), className)}
      {...props}
    />
  );
}

export { StatusPill, type StatusPillProps };
