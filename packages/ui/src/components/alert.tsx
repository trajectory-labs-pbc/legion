import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { textVariants } from "#registry/legion/lib/typography";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-x-0 gap-y-0.5 rounded-lg border text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        danger: "border-danger-border bg-danger-tint text-foreground [&>svg]:text-danger",
        warning: "border-warning-border bg-warning-tint text-foreground [&>svg]:text-warning",
        success: "border-success-border bg-success-tint text-foreground [&>svg]:text-success",
      },
      size: {
        default: "px-4 py-3",
        compact:
          "items-center px-3 py-1.5 [&>svg]:translate-y-0 [&_[data-slot=alert-description]]:text-xs [&_[data-slot=alert-title]]:text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Alert({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ variant, size }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        textVariants({ tone: "muted" }),
        "col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("col-start-3 row-span-full self-center justify-self-end pl-3", className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
