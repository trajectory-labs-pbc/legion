import type { ReactNode } from "react";
import {
  type MarginDrawer,
  MarginProvider,
  MarginSlotProvider,
  ReferenceNamesProvider,
  type ShellNavigation,
  ShellNavigationContext,
  ShortcutHelpOpener,
} from "@/upstream/shell";

/** The contexts upstream's pages read from the shell. */
export function ShellProviders({
  children,
  drawer,
  navigation,
  openShortcuts,
}: {
  children: ReactNode;
  drawer: MarginDrawer | undefined;
  navigation: ShellNavigation | undefined;
  openShortcuts: () => void;
}) {
  return (
    <MarginProvider>
      <ReferenceNamesProvider>
        <MarginSlotProvider drawer={drawer} drawsSlot={drawer !== undefined}>
          <ShellNavigationContext.Provider value={navigation}>
            <ShortcutHelpOpener.Provider value={openShortcuts}>
              {children}
            </ShortcutHelpOpener.Provider>
          </ShellNavigationContext.Provider>
        </MarginSlotProvider>
      </ReferenceNamesProvider>
    </MarginProvider>
  );
}
