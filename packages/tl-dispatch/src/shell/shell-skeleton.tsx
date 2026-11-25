import {
  canvasText,
  railActiveBg,
  railBg,
  railBorder,
  railText,
  skeletonBg,
} from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

/** The shell's outline, shown while the sign-in check is out. */
export function ShellSkeleton(): ReactNode {
  return (
    <div aria-busy="true" className={`xl:flex ${canvasText}`}>
      <header
        className={`flex items-center px-3 xl:hidden ${railBorder} ${railBg} ${railText} border-b`}
      >
        <span className="text-lg font-semibold">Dispatch</span>
      </header>
      <aside
        className={`hidden p-5 xl:block xl:min-h-dvh xl:w-80 xl:border-r ${railBorder} ${railBg} ${railText}`}
      >
        <span className="text-lg font-semibold">Dispatch</span>
        <div aria-label="Loading navigation" className="mt-6 space-y-2" role="status">
          {[0, 1, 2, 3].map((row) => (
            <div className={`h-4 w-full animate-pulse rounded ${railActiveBg}`} key={row} />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <div aria-label="Loading Dispatch" className="space-y-3" role="status">
          {[0, 1, 2].map((row) => (
            <div className={`h-4 w-full animate-pulse rounded ${skeletonBg}`} key={row} />
          ))}
        </div>
      </main>
    </div>
  );
}
