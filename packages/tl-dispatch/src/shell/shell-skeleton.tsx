import { NavSurface } from "@legion/ui/components/nav";
import { Skeleton } from "@legion/ui/components/skeleton";
import type { ReactNode } from "react";
import { PageSkeleton } from "@/loading/page-skeleton";
import { AppNameText } from "./app-name";
import { ContentPanel } from "./content-panel";

const ROWS = [0, 1, 2, 3];

/** The shell's outline, shown while the sign-in check is out. */
export function ShellSkeleton(): ReactNode {
  return (
    <div aria-busy="true" className="text-foreground md:flex">
      <NavSurface className="flex h-11 items-center px-2 md:hidden" render={<header />}>
        <AppNameText />
      </NavSurface>
      <NavSurface className="hidden p-2 md:block md:min-h-dvh md:w-60 md:shrink-0">
        <div className="flex h-11 items-center">
          <AppNameText />
        </div>
        <div aria-label="Loading navigation" className="mt-2 space-y-0.5" role="status">
          {ROWS.map((row) => (
            <Skeleton className="h-7 w-full" key={row} />
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
          <PageSkeleton label="Loading Dispatch" />
        </main>
      </ContentPanel>
    </div>
  );
}
