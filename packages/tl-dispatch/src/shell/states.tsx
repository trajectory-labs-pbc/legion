import { useQueryClient } from "@tanstack/react-query";
import { ISSUE_TAB_LABELS } from "@upstream-dispatch/features/issue/issue-tab-list";
import { KeptWrites } from "@upstream-dispatch/features/writes/KeptWrites";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import {
  borderDefault,
  borderStrong,
  borderTransparent,
  canvasText,
  card,
  linkHoverText,
  linkText,
  primaryButtonBg,
  primaryButtonHoverBg,
  railActiveBg,
  railBg,
  railBorder,
  railText,
  skeletonBg,
  textMutedOnSurface,
  textSecondaryOnSurface,
  textTransparent,
} from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

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

function ShellMessagePage({ children, title }: { children?: ReactNode; title: string }): ReactNode {
  return (
    <main className={`grid min-h-dvh place-items-center px-6 ${canvasText}`}>
      <section className={`w-full max-w-md rounded-2xl p-8 shadow-sm ${card}`}>
        <p className={`text-sm font-medium tracking-wide uppercase ${textMutedOnSurface}`}>
          Dispatch
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        {children}
      </section>
    </main>
  );
}

/** The sign-in page; a lapsed session shows the writes it keeps. */
export function SignInPage(): ReactNode {
  const queryClient = useQueryClient();
  return (
    <ShellMessagePage title="Make the next decision clear.">
      <p className={`mt-3 ${textSecondaryOnSurface}`}>
        Sign in to review your team&apos;s open decisions.
      </p>
      <a
        className={`mt-8 inline-flex rounded-lg px-4 py-2 font-semibold ${primaryButtonBg} ${primaryButtonHoverBg}`}
        href="/auth/start"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          writesOf(queryClient).leavingToSignIn();
        }}
      >
        Sign in with Google
      </a>
      <KeptWrites />
    </ShellMessagePage>
  );
}

export function ConnectionErrorPage({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <ShellMessagePage title="Couldn't reach Dispatch.">
      <div className="mt-4" role="alert">
        <button
          className={`text-sm font-medium underline ${linkText} ${linkHoverText}`}
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    </ShellMessagePage>
  );
}

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
