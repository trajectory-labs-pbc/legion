import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { MouseEvent } from "react";
import { Spinner } from "#registry/legion/ui/spinner";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50",
    "aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-field hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      // One height scale for every control: xs 24px, sm 28px, default 32px, lg 36px.
      size: {
        default: "h-8 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 has-[>svg]:px-2",
        lg: "h-9 px-4 has-[>svg]:px-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonProps = useRender.ComponentProps<"button"> &
  ButtonVariants & {
    /** Shows a spinner and blocks the press; the button keeps the focus. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  loading = false,
  disabled,
  onClick,
  children,
  ...props
}: ButtonProps) {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      "data-disabled": loading || undefined,
      disabled: loading ? undefined : disabled,
      "aria-disabled": loading || undefined,
      "aria-busy": loading || undefined,
      // preventDefault also stops a submit button's submit, the implicit one on Enter included.
      onClick: loading ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : onClick,
      className: cn(buttonVariants({ variant, size }), className),
      ...props,
      children: (
        <>
          {loading && <Spinner aria-hidden="true" className="size-[1em]" />}
          {children}
        </>
      ),
    },
  });
}

export { Button, type ButtonProps, type ButtonVariants, buttonVariants };
