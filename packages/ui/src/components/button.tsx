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
    "aria-invalid:border-danger",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // Loading: the spinner takes the start icon's place, or an icon button's only icon.
    "data-loading:[&>[data-icon=inline-start]]:hidden",
    "data-loading:data-[size^=icon]:[&>svg:not([data-slot=spinner])]:hidden",
    // A text button with no start icon keeps its width: the spinner sits over its transparent label.
    "data-loading:not-data-[size^=icon]:not-has-[>[data-icon=inline-start]]:text-transparent",
    "data-loading:not-data-[size^=icon]:not-has-[>[data-icon=inline-start]]:[&>svg:not([data-slot=spinner])]:invisible",
    "data-loading:not-data-[size^=icon]:not-has-[>[data-icon=inline-start]]:[&>[data-slot=spinner]]:absolute",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground [&>[data-slot=spinner]]:text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 [&>[data-slot=spinner]]:text-destructive-foreground",
        outline:
          "border border-input bg-field hover:bg-secondary hover:text-secondary-foreground [&>[data-slot=spinner]]:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 [&>[data-slot=spinner]]:text-secondary-foreground",
        // On a navigation surface, a ghost button hovers as a row does.
        ghost:
          "hover:bg-secondary hover:text-secondary-foreground in-data-[slot=nav-surface]:hover:bg-sidebar-accent/50 in-data-[slot=nav-surface]:hover:text-sidebar-accent-foreground [&>[data-slot=spinner]]:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline [&>[data-slot=spinner]]:text-foreground",
        // A destructive action beside others: danger text, the danger tint on hover.
        "quiet-danger": "text-danger hover:bg-danger-tint [&>[data-slot=spinner]]:text-danger",
      },
      // One height scale for every control: xs 24px, sm 28px, default 32px, lg 36px. An icon
      // marked `data-icon="inline-start"` or `"inline-end"` takes a little of its side's padding.
      size: {
        default: "h-8 px-3 has-data-[icon=inline-start]:pl-2.5 has-data-[icon=inline-end]:pr-2.5",
        xs: "h-6 gap-1 px-2 text-xs has-data-[icon=inline-start]:pl-1.5 has-data-[icon=inline-end]:pr-1.5 [&_svg:not([class*='size-'])]:size-3 [&>[data-slot=spinner]]:size-3",
        sm: "h-control-sm gap-1.5 px-2.5 has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-end]:pr-2",
        lg: "h-9 px-4 has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-end]:pr-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3 [&>[data-slot=spinner]]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    // A link draws no box, so its text lines up with the text around it.
    compoundVariants: [
      {
        variant: "link",
        className: "px-0 has-data-[icon=inline-start]:pl-0 has-data-[icon=inline-end]:pr-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

type ButtonProps = useRender.ComponentProps<"button"> &
  ButtonVariants & {
    /** Shows a spinner and blocks the press; the button keeps its focus and its width. */
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
      "data-loading": loading || undefined,
      disabled: loading ? undefined : disabled,
      "aria-disabled": loading || undefined,
      "aria-busy": loading || undefined,
      // preventDefault also stops a submit button's submit, the implicit one on Enter included.
      onClick: loading ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : onClick,
      className: cn(buttonVariants({ variant, size }), className),
      ...props,
      children: (
        <>
          {loading && <Spinner aria-hidden="true" />}
          {children}
        </>
      ),
    },
  });
}

export { Button, type ButtonProps, type ButtonVariants, buttonVariants };
