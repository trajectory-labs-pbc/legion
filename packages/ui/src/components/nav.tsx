import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";

/** The surface a navigation sits on, a sidebar or its drawer, on the window's ground. */
function NavSurface({ className, render, ...props }: useRender.ComponentProps<"aside">) {
  return useRender({
    defaultTagName: "aside",
    render,
    props: {
      "data-slot": "nav-surface",
      className: cn("border-sidebar-border bg-background text-sidebar-foreground", className),
      ...props,
    },
  });
}

/**
 * One row of a navigation list, 28px high: a link by default, or what `render` gives. The row
 * of the page that is open carries `aria-current="page"`.
 */
function NavRow({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      "data-slot": "nav-row",
      className: cn(
        "flex h-7 items-center gap-2 rounded-md px-2 text-sm",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground",
        className
      ),
      ...props,
    },
  });
}

export { NavRow, NavSurface };
