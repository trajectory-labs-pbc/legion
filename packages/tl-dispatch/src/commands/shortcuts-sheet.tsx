import { useState } from "react";

import { lazyRegion } from "@/loading/lazy-region";
import type { ShortcutsSheetProps } from "./shortcuts-sheet-view";

const View = lazyRegion(
  "the shortcuts sheet",
  () => import("./shortcuts-sheet-view"),
  "ShortcutsSheetView"
);

/** The shortcuts sheet, whose code loads the first time it opens and stays for its close. */
export function ShortcutsSheet(props: ShortcutsSheetProps) {
  const [opened, setOpened] = useState(false);
  if (props.open && !opened) setOpened(true);
  return opened ? <View {...props} /> : null;
}
