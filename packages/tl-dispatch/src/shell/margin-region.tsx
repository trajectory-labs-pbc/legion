import { MarginColumn } from "@upstream-dispatch/features/margin/MarginColumn";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import type { ShellPreferences } from "./use-shell-preferences";

/** The margin column, which an upstream page fills. */
export function MarginRegion({
  pathname,
  preferences,
}: {
  pathname: string;
  preferences: Pick<
    ShellPreferences,
    "marginHidden" | "setMarginHidden" | "marginWidth" | "setMarginWidth"
  >;
}) {
  return (
    <ErrorBoundary region="the margin" resetKey={pathname}>
      <MarginColumn
        collapsed={preferences.marginHidden}
        onCollapsedChange={preferences.setMarginHidden}
        onWidthChange={preferences.setMarginWidth}
        width={preferences.marginWidth}
      />
    </ErrorBoundary>
  );
}
