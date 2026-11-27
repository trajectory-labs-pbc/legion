import { lazyOverlay } from "@/loading/lazy-region";

/** The navigation drawer, whose code loads the first time it opens and stays for its close. */
export const NavigationDrawer = lazyOverlay(
  "the navigation",
  () => import("./navigation-drawer-view"),
  "NavigationDrawerView"
);
