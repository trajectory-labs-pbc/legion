import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "cn";

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent text-xs font-medium whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        muted: "bg-muted text-muted-foreground [a&]:hover:bg-muted/80",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        danger: "border-danger-border bg-danger-tint text-danger",
        warning: "border-warning-border bg-warning-tint text-warning",
        success: "border-success-border bg-success-tint text-success",
      },
      size: {
        default: "px-1.5 py-0.5",
        // A number alone: a 20 px chip, at least as wide as it is high.
        count: "h-5 min-w-5 px-1 tabular-nums",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type BadgeVariants = VariantProps<typeof badgeVariants>;

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & BadgeVariants) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "badge",
      "data-variant": variant,
      "data-size": size,
      className: cn(badgeVariants({ variant, size }), className),
      ...props,
    },
  });
}

export { Badge, type BadgeVariants, badgeVariants };
