import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { useAgentPinWrite } from "@upstream-dispatch/features/agents/pins";
import { useRecordRecents } from "@upstream-dispatch/features/search/recents";

import { CompactHeader } from "./compact-header";
import { ContentPanel } from "./content-panel";
import { MainRegion } from "./main-region";
import { MarginRegion } from "./margin-region";
import { NavigationDrawer } from "./navigation-drawer";
import { NavigationPanel } from "./navigation-panel";
import { ShellDialogs } from "./shell-dialogs";
import { ShellFrame } from "./shell-frame";
import { ShellProviders } from "./shell-providers";
import { SidebarRegion } from "./sidebar-region";
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
  const { preferences } = shell;
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
        {shell.inDrawer ? (
          <NavigationDrawer
            initialFocus={overlays.closeButtonRef}
            onClose={overlays.closeNavigation}
            open={overlays.navigationOpen}
          >
            {panel}
          </NavigationDrawer>
        ) : null}
        <SidebarRegion
          folded={preferences.sidebarHidden}
          inDrawer={shell.inDrawer}
          issueRail={shell.issueFrame && !shell.compact}
          navigationOpen={overlays.navigationOpen}
          onOpenNavigation={overlays.openNavigation}
          project={shell.project}
          user={user}
        >
          {panel}
        </SidebarRegion>
        <ContentPanel
          fillsViewport={shell.fillsViewport}
          issueFrame={shell.issueFrame}
          marginRail={shell.hasMargin && preferences.marginHidden}
          sidebarFolded={preferences.sidebarHidden}
        >
          <MainRegion
            fillsViewport={shell.fillsViewport}
            hasMargin={shell.hasMargin}
            issueFrame={shell.issueFrame}
            liveView={shell.liveView}
            mainRef={shell.mainRef}
            marginHidden={preferences.marginHidden}
            pathname={shell.pathname}
            sidebarHidden={preferences.sidebarHidden}
          />
          <MarginRegion pathname={shell.pathname} preferences={preferences} />
        </ContentPanel>
        <ShellDialogs
          closeCreate={overlays.closeCreate}
          closeInboxDrawer={overlays.closeInboxDrawer}
          closeSearch={overlays.closeSearch}
          createOpen={overlays.createOpen}
          inboxDrawerOpen={overlays.inboxDrawerOpen}
          searchOpen={overlays.searchOpen}
          shortcuts={overlays.shortcuts}
        />
      </ShellFrame>
    </ShellProviders>
  );
}
