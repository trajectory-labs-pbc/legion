import { NavSurface } from "@legion/ui/components/nav";
import { Skeleton } from "@legion/ui/components/skeleton";
import type { ReactNode } from "react";

const ROWS = [0, 1, 2, 3];

/** The shell's outline, shown while the sign-in check is out. */
export function ShellSkeleton(): ReactNode {
  return (
    <div aria-busy="true" className="text-foreground xl:flex">
      <NavSurface className="flex items-center border-b px-3 xl:hidden" render={<header />}>
        <span className="text-lg font-semibold">Dispatch</span>
      </NavSurface>
      <NavSurface className="hidden p-4 xl:block xl:min-h-dvh xl:w-72 xl:border-r">
        <span className="text-lg font-semibold">Dispatch</span>
        <div aria-label="Loading navigation" className="mt-6 space-y-2" role="status">
          {ROWS.map((row) => (
            <Skeleton className="h-4 w-full bg-sidebar-accent" key={row} />
          ))}
        </div>
      </NavSurface>
      <main className="min-w-0 flex-1 p-6">
        <div aria-label="Loading Dispatch" className="space-y-3" role="status">
          {ROWS.slice(0, 3).map((row) => (
            <Skeleton className="h-4 w-full" key={row} />
          ))}
        </div>
      </main>
    </div>
  );
}
