import { DEFAULT_MARGIN_WIDTH } from "@upstream-dispatch/features/margin/margin-width";
import { useUserPreference } from "@upstream-dispatch/features/shell/userPreference";

const hiddenOrShown = [
  (stored: string | null) => stored === "hidden",
  (hidden: boolean) => (hidden ? "hidden" : "shown"),
] as const;

function storedWidth(stored: string | null): number {
  const width = Number(stored);
  return stored !== null && Number.isInteger(width) ? width : DEFAULT_MARGIN_WIDTH;
}

/** The layout choices the reader keeps across visits: the sidebar, the margin and its width. */
export function useShellPreferences() {
  const [sidebarHidden, setSidebarHidden] = useUserPreference("shell.sidebar", ...hiddenOrShown);
  const [marginHidden, setMarginHidden] = useUserPreference("shell.margin", ...hiddenOrShown);
  const [marginWidth, setMarginWidth] = useUserPreference(
    "shell.margin-width",
    storedWidth,
    String
  );
  return {
    sidebarHidden,
    setSidebarHidden,
    marginHidden,
    setMarginHidden,
    marginWidth,
    setMarginWidth,
  };
}

/** The wide layout's room for the folded sidebar and margin rails beside main. */
export function mainLayoutClass({
  sidebarHidden,
  hasMargin,
  marginHidden,
}: {
  sidebarHidden: boolean;
  hasMargin: boolean;
  marginHidden: boolean;
}): string {
  const marginRail = hasMargin && marginHidden;
  if (sidebarHidden && marginRail) return "xl:w-full xl:pl-20 xl:pr-20";
  if (sidebarHidden && !hasMargin) return "xl:w-full xl:pl-20";
  if (sidebarHidden) return "xl:pl-20";
  return marginRail ? "xl:pr-20" : "";
}
