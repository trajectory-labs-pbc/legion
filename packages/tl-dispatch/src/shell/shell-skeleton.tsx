import { NavSurface } from "@legion/ui/components/nav";
import { Skeleton } from "@legion/ui/components/skeleton";
import type { ReactNode } from "react";
import { ContentPanel } from "./content-panel";

const ROWS = [0, 1, 2, 3];

/** The shell's outline, shown while the sign-in check is out. */
export function ShellSkeleton(): ReactNode {
  return (
    <div aria-busy="true" className="text-foreground md:flex">
      <NavSurface className="flex h-11 items-center px-4 md:hidden" render={<header />}>
        <span className="text-sm font-semibold">Dispatch</span>
      </NavSurface>
      <NavSurface className="hidden p-2 md:block md:min-h-dvh md:w-60 md:shrink-0">
        <span className="flex h-11 items-center px-2 text-sm font-semibold">Dispatch</span>
        <div aria-label="Loading navigation" className="mt-2 space-y-2 px-2" role="status">
          {ROWS.map((row) => (
            <Skeleton className="h-4 w-full bg-sidebar-accent" key={row} />
          ))}
        </div>
      </NavSurface>
      <ContentPanel
        fillsViewport={false}
        issueFrame={false}
        marginRail={false}
        sidebarFolded={false}
      >
        <main className="min-w-0 flex-1 p-6">
          <div aria-label="Loading Dispatch" className="space-y-3" role="status">
            {ROWS.slice(0, 3).map((row) => (
              <Skeleton className="h-4 w-full" key={row} />
            ))}
          </div>
        </main>
      </ContentPanel>
    </div>
  );
}
