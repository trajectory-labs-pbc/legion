import { cn } from "@legion/ui/lib/utils";
import type { ReactNode } from "react";

/** The frame's box, which a page that fills the viewport makes exactly the viewport. */
export function ShellFrame({
  children,
  fillsViewport,
}: {
  children: ReactNode;
  fillsViewport: boolean;
}) {
  return (
    <div
      className={cn(
        fillsViewport
          ? "flex h-screen flex-col supports-[height:100dvh]:h-dvh xl:flex-row"
          : "xl:flex",
        "text-foreground"
      )}
      data-testid="app-shell"
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-sidebar focus:px-4 focus:py-2 focus:text-sidebar-foreground"
        href="#main-content"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}
