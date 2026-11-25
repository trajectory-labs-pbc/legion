import { ISSUE_TAB_LABELS } from "@upstream-dispatch/features/issue/issue-tab-list";
import {
  borderDefault,
  borderStrong,
  borderTransparent,
  linkText,
  skeletonBg,
  textTransparent,
} from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

/** What main shows while an issue page's code loads: the tabbed page's outline. */
export function IssuePageFallback(): ReactNode {
  return (
    <div aria-busy="true">
      <header className={`mb-6 border-b pb-6 ${borderDefault}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${linkText}`}>
            <span
              className={`inline-block h-4 w-16 animate-pulse rounded align-middle ${skeletonBg}`}
            />
          </p>
          <button
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${textTransparent} ${borderStrong}`}
            disabled
            type="button"
          >
            Pin issue
          </button>
        </div>
        <h1
          className={`mt-2 w-full rounded-lg border px-2 py-1 text-2xl font-semibold ${borderTransparent}`}
        >
          <span
            className={`inline-block h-7 w-2/3 animate-pulse rounded align-middle ${skeletonBg}`}
          />
        </h1>
      </header>
      <div className={`mb-4 flex gap-2 overflow-hidden border-b ${borderDefault}`} role="tablist">
        {ISSUE_TAB_LABELS.map((label) => (
          <span
            className={`animate-pulse rounded px-3 py-2 text-sm ${textTransparent} ${skeletonBg}`}
            key={label}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div className={`h-4 w-full animate-pulse rounded ${skeletonBg}`} key={row} />
        ))}
      </div>
    </div>
  );
}

/** The outline issue page's loading frame: boxes with no words in them. */
export function IssueFrameFallback(): ReactNode {
  return (
    <div aria-busy="true" className="px-3.5 pt-2 md:px-7">
      <div className={`h-4 w-16 animate-pulse rounded ${skeletonBg}`} />
      <div className={`mt-2 h-7 w-2/3 animate-pulse rounded ${skeletonBg}`} />
      <div
        className={`mt-4 mb-4 flex min-w-0 gap-2 overflow-hidden border-b pb-2 ${borderDefault}`}
        role="toolbar"
      >
        {[0, 1, 2, 3, 4].map((box) => (
          <span className={`h-5 w-16 shrink-0 animate-pulse rounded ${skeletonBg}`} key={box} />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div className={`h-4 w-full animate-pulse rounded ${skeletonBg}`} key={row} />
        ))}
      </div>
    </div>
  );
}
