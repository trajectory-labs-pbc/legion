import { NavSurface } from "@legion/ui/components/nav";
import { Skeleton } from "@legion/ui/components/skeleton";
import type { ReactNode } from "react";

const ROWS = [0, 1, 2, 3];

/** The shell's outline, shown while the sign-in check is out. */
export function ShellSkeleton(): ReactNode {
  return (
    <div aria-busy="true" className="text-foreground xl:flex">
      <NavSurface className="flex h-11 items-center px-4 xl:hidden" render={<header />}>
        <span className="text-sm font-semibold">Dispatch</span>
      </NavSurface>
      <NavSurface className="hidden p-2 xl:block xl:min-h-dvh xl:w-60 xl:shrink-0">
        <span className="flex h-11 items-center px-2 text-sm font-semibold">Dispatch</span>
        <div aria-label="Loading navigation" className="mt-2 space-y-2 px-2" role="status">
          {ROWS.map((row) => (
            <Skeleton className="h-4 w-full bg-sidebar-accent" key={row} />
          ))}
        </div>
      </NavSurface>
      <main className="min-h-[calc(100dvh-3.25rem)] min-w-0 flex-1 border-border bg-card p-6 max-md:border-t md:mx-2 md:mb-2 md:border xl:mt-2 xl:ml-0 xl:min-h-[calc(100dvh-1rem)]">
        <div aria-label="Loading Dispatch" className="space-y-3" role="status">
          {ROWS.slice(0, 3).map((row) => (
            <Skeleton className="h-4 w-full" key={row} />
          ))}
        </div>
      </main>
    </div>
  );
}
