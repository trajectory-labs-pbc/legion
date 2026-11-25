import {
  type MarginDrawer,
  MarginSlotProvider,
} from "@upstream-dispatch/features/issue-page/margin-slot";
import { ReferenceNamesProvider } from "@upstream-dispatch/features/issue-page/reference-names";
import {
  type ShellNavigation,
  ShellNavigationContext,
} from "@upstream-dispatch/features/issue-page/shell-navigation";
import { ShortcutHelpOpener } from "@upstream-dispatch/features/issue-page/shortcut-help-opener";
import { MarginProvider } from "@upstream-dispatch/features/margin/margin-context";
import type { ReactNode } from "react";

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
