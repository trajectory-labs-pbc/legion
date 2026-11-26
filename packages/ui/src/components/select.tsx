import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { popupMotion } from "#registry/legion/lib/overlay-styles";

const Select = SelectPrimitive.Root;

function SelectGroup(props: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-field px-2.5 text-sm whitespace-nowrap data-[size=default]:h-8 data-[size=sm]:h-7",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger data-[placeholder]:text-muted-foreground",
        "*:data-[slot=select-value]:truncate [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />}
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "alignItemWithTrigger"
  >) {
  // z-50 on the portal puts Base UI's modal backdrop over a sheet's scrim below.
  return (
    <SelectPrimitive.Portal className="relative z-50">
      <SelectPrimitive.Positioner
        className="isolate z-50"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 max-h-(--available-height) min-w-[max(8rem,var(--anchor-width))] overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-popover outline-hidden",
            popupMotion,
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex h-7 w-full cursor-default items-center gap-2 rounded-sm pr-8 pl-2 text-sm outline-hidden select-none",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:inset-ring data-highlighted:inset-ring-muted-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon aria-hidden="true" className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({ className, ...props }: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon aria-hidden="true" className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({ className, ...props }: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon aria-hidden="true" className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
