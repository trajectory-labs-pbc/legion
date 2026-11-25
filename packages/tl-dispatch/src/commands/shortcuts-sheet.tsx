import { lazyOverlay } from "@/loading/lazy-region";
import { IS_MAC } from "./key-chips";
import type { ShortcutsSheetProps } from "./shortcuts-sheet-view";

const View = lazyOverlay(
  "the shortcuts sheet",
  () => import("./shortcuts-sheet-view"),
  "ShortcutsSheetView"
);

/** The shortcuts sheet, whose code loads the first time it opens and stays for its close. */
export function ShortcutsSheet(props: Omit<ShortcutsSheetProps, "mac">) {
  return <View {...props} mac={IS_MAC} />;
}
