import { useState } from "react";

import { lazyRegion } from "@/loading/lazy-region";
import { IS_MAC } from "./key-chips";
import type { ShortcutsSheetProps } from "./shortcuts-sheet-view";

const View = lazyRegion(
  "the shortcuts sheet",
  () => import("./shortcuts-sheet-view"),
  "ShortcutsSheetView"
);

/** The shortcuts sheet, whose code loads the first time it opens and stays for its close. */
export function ShortcutsSheet(props: Omit<ShortcutsSheetProps, "mac">) {
  const [opened, setOpened] = useState(false);
  if (props.open && !opened) setOpened(true);
  return opened ? <View {...props} mac={IS_MAC} /> : null;
}
