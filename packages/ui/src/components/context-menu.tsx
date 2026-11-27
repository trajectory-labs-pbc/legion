import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { cn } from "cn";
import {
  DropdownMenuCheckboxItem as ContextMenuCheckboxItem,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuLinkItem as ContextMenuLinkItem,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuShortcut as ContextMenuShortcut,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
  menuPopupClass,
} from "#registry/legion/ui/dropdown-menu";

// A context menu's items are the menu's own, so it takes them from the dropdown menu.

const ContextMenu = ContextMenuPrimitive.Root;

function ContextMenuTrigger(props: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

// At the viewport's edge the menu flips to the pointer's other side rather than covering it.
const CONTEXT_MENU_COLLISION_AVOIDANCE = {
  side: "flip",
  align: "shift",
  fallbackAxisSide: "none",
} as const;

function ContextMenuContent({
  className,
  side = "right",
  align = "start",
  sideOffset = 2,
  alignOffset = 0,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">) {
  // z-50 on the portal puts Base UI's modal backdrop over a sheet's scrim below.
  return (
    <ContextMenuPrimitive.Portal className="relative z-50">
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-hidden"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionAvoidance={CONTEXT_MENU_COLLISION_AVOIDANCE}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(menuPopupClass, className)}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuLinkItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
