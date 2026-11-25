import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { useAgentPinWrite } from "@upstream-dispatch/features/agents/pins";
import { useRecordRecents } from "@upstream-dispatch/features/search/recents";

import { CompactHeader } from "./compact-header";
import { NavigationPanel } from "./navigation-panel";
import {
  MainRegion,
  MarginRegion,
  NavigationDrawer,
  ShellDialogs,
  ShellFrame,
  ShellProviders,
  SidebarRegion,
} from "./shell-frame";
import { StatusCorner } from "./status-corner";
import { useLiveViewPins, usePinsMigration } from "./use-agent-pins";
import { useShellLayout } from "./use-shell-layout";
import { useShellOverlays } from "./use-shell-overlays";
import { useSignOut } from "./use-sign-out";

/** The frame around every page: its providers, the layout's regions and the page outlet. */
export function AppShell({ user }: { user: AuthenticatedUser }) {
  useRecordRecents();
  useLiveViewPins();
  usePinsMigration(user.login, useAgentPinWrite());
  const signOut = useSignOut(user.login);
  const shell = useShellLayout();
  const overlays = useShellOverlays(shell);
  const panel = (
    <NavigationPanel
      closeButtonRef={overlays.closeButtonRef}
      compact={shell.inDrawer}
      onClose={overlays.closeNavigation}
      signOut={signOut}
      user={user}
    />
  );
  return (
    <ShellProviders
      drawer={shell.detailsDrawer}
      navigation={overlays.shellNavigation}
      openShortcuts={overlays.openShortcuts}
    >
      <ShellFrame fillsViewport={shell.fillsViewport}>
        <StatusCorner />
        {shell.compact && !shell.issueFrame ? (
          <CompactHeader
            navigationOpen={overlays.navigationOpen}
            onInbox={shell.onInbox}
            onOpenNavigation={overlays.openNavigation}
          />
        ) : null}
        {shell.inDrawer && overlays.navigationOpen ? (
          <NavigationDrawer
            containerRef={overlays.drawer.containerRef}
            onClose={overlays.closeNavigation}
          >
            {panel}
          </NavigationDrawer>
        ) : null}
        <SidebarRegion overlays={overlays} shell={shell} user={user}>
          {panel}
        </SidebarRegion>
        <MainRegion shell={shell} />
        <MarginRegion shell={shell} />
        <ShellDialogs overlays={overlays} />
      </ShellFrame>
    </ShellProviders>
  );
}
