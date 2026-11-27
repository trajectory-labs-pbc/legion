import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { highlightClass, popupMotion } from "#registry/legion/lib/overlay-styles";
import { KbdSequence, type KeySteps } from "#registry/legion/ui/kbd";
import { useIsInsideModalSurface } from "#registry/legion/ui/modal-surface-context";

function DropdownMenu<Payload = unknown>({ modal, ...props }: MenuPrimitive.Root.Props<Payload>) {
  const insideModalSurface = useIsInsideModalSurface();
  return <MenuPrimitive.Root<Payload> modal={modal ?? insideModalSurface} {...props} />;
}

function DropdownMenuTrigger<Payload = unknown>(props: MenuPrimitive.Trigger.Props<Payload>) {
  return <MenuPrimitive.Trigger<Payload> data-slot="dropdown-menu-trigger" {...props} />;
}

/** Class names for a menu's popup, shared with the context menu. */
const menuPopupClass = cn(
  "z-50 max-h-(--available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 shadow-popover text-popover-foreground outline-hidden",
  popupMotion
);

type DropdownMenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">;

function DropdownMenuContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  children,
  ...props
}: DropdownMenuContentProps) {
  // z-50 on the portal puts Base UI's modal backdrop over a sheet's scrim below.
  return (
    <MenuPrimitive.Portal className="relative z-50">
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-hidden"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(menuPopupClass, className)}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

// When one row of the menu leads with an icon or a check, every row and label keeps that room. A
// trailing icon, such as the submenu's chevron, is marked `data-icon="inline-end"`.
const ICON_ROOM_CLASS =
  "in-[[role=menu]:has(svg:first-child:not([data-icon=inline-end]),[role=menuitemcheckbox])]:not-has-[>svg:first-child:not([data-icon=inline-end])]:pl-8";

const ITEM_CLASS = `relative flex h-control-sm cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-hidden select-none ${highlightClass} ${ICON_ROOM_CLASS} data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground`;

const DESTRUCTIVE_CLASS =
  "data-[variant=destructive]:text-danger data-[variant=destructive]:data-highlighted:bg-danger-tint data-[variant=destructive]:data-highlighted:text-danger data-[variant=destructive]:*:[svg]:text-danger!";

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & { variant?: "default" | "destructive" }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(ITEM_CLASS, DESTRUCTIVE_CLASS, className)}
      {...props}
    />
  );
}

function DropdownMenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      className={cn(ITEM_CLASS, className)}
      {...props}
    />
  );
}

// A checkbox item stays open, so several can change in one visit; a radio item closes on its choice.
function DropdownMenuCheckboxItem({
  className,
  children,
  closeOnClick = false,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      closeOnClick={closeOnClick}
      className={cn(ITEM_CLASS, "pl-8", className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon aria-hidden="true" className="size-4" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  closeOnClick = true,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      closeOnClick={closeOnClick}
      className={cn(ITEM_CLASS, "pr-8", className)}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon aria-hidden="true" className="size-4" data-icon="inline-end" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        ICON_ROOM_CLASS,
        className
      )}
      {...props}
    />
  );
}

// A separator draws only between rows: none first, none last, one where two meet. It shows when
// a row comes anywhere before it and a row right after it.
const SEPARATOR_CLASS =
  "-mx-1 my-1 hidden h-px bg-border [:not([data-slot=dropdown-menu-separator])~&]:has-[+:not([data-slot=dropdown-menu-separator])]:block";

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(SEPARATOR_CLASS, className)}
      {...props}
    />
  );
}

/** A menu row's key at its right, drawn as the app draws every key. */
function DropdownMenuShortcut({ className, steps }: { className?: string; steps: KeySteps }) {
  return <KbdSequence className={cn("ml-auto", className)} steps={steps} />;
}

function DropdownMenuSub(props: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        ITEM_CLASS,
        "data-popup-open:bg-accent data-popup-open:text-accent-foreground data-popup-open:inset-ring data-popup-open:inset-ring-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="ml-auto size-4" data-icon="inline-end" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

// At the viewport's edge a submenu shifts to stay level with its trigger; a flip would move it
// away from the pointer.
const SUBMENU_COLLISION_AVOIDANCE = { align: "shift", fallbackAxisSide: "end" } as const;

function DropdownMenuSubContent({
  className,
  side = "right",
  align = "start",
  sideOffset = 0,
  alignOffset = 0,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-hidden"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionAvoidance={SUBMENU_COLLISION_AVOIDANCE}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(menuPopupClass, className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  menuPopupClass,
};
