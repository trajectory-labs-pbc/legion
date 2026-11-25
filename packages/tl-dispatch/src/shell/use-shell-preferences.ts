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

export interface ShellPreferences {
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
  marginHidden: boolean;
  setMarginHidden: (hidden: boolean) => void;
  marginWidth: number;
  setMarginWidth: (width: number) => void;
}

/** The layout choices the reader keeps across visits: the sidebar, the margin and its width. */
export function useShellPreferences(): ShellPreferences {
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
