import { type ComponentProps, useState } from "react";

import { lazyRegion } from "@/loading/lazy-region";
import type { NavigationDrawerView } from "./navigation-drawer-view";

const View = lazyRegion(
  "the navigation",
  () => import("./navigation-drawer-view"),
  "NavigationDrawerView"
);

/** The navigation drawer, whose code loads the first time it opens and stays for its close. */
export function NavigationDrawer(props: ComponentProps<typeof NavigationDrawerView>) {
  const [opened, setOpened] = useState(false);
  if (props.open && !opened) setOpened(true);
  return opened ? <View {...props} /> : null;
}
