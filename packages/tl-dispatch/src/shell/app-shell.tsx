import type { AuthenticatedUser } from "@/data/session";

import { CompactHeader } from "./compact-header";
import { ContentPanel } from "./content-panel";
import { MainRegion } from "./main-region";
import { MarginRegion } from "./margin-region";
import { NavigationDrawer } from "./navigation-drawer";
import { NavigationPanel } from "./navigation-panel";
import { ShellBackground } from "./shell-background";
import { ShellDialogs } from "./shell-dialogs";
import { ShellFrame } from "./shell-frame";
import { ShellProviders } from "./shell-providers";
import { SidebarRegion } from "./sidebar-region";
import { SignOutQuestion } from "./sign-out-question";
import { StatusCorner } from "./status-corner";
import { useShellLayout } from "./use-shell-layout";
import { useShellOverlays } from "./use-shell-overlays";
import { useSignOut } from "./use-sign-out";

/** The frame around every page: the layout's regions and the page outlet. */
export function AppShell({ user }: { user: AuthenticatedUser }) {
  const signOut = useSignOut(user.login);
  const shell = useShellLayout();
  const { preferences } = shell;
  const overlays = useShellOverlays(shell, signOut.pending ? undefined : signOut.start);
  const panel = (
    <NavigationPanel
      closeButtonRef={overlays.closeButtonRef}
      compact={shell.inDrawer}
      onClose={overlays.closeNavigation}
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
        <StatusCorner signOut={signOut} />
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
          sidebarRef={overlays.sidebarRef}
          user={user}
        >
          {panel}
        </SidebarRegion>
        <ContentPanel
          fillsViewport={shell.fillsViewport}
          issueFrame={shell.issueFrame}
          marginRail={shell.hasMargin && preferences.marginHidden}
          openerRef={overlays.openerRef}
          sidebarFolded={preferences.sidebarHidden && !shell.inDrawer}
        >
          <MainRegion shell={shell} />
          <MarginRegion pathname={shell.pathname} preferences={preferences} />
        </ContentPanel>
        <ShellDialogs
          closeCreate={overlays.closeCreate}
          closeSearch={overlays.closeSearch}
          createOpen={overlays.createOpen}
          searchOpen={overlays.searchOpen}
          shortcuts={overlays.shortcuts}
        />
        <ShellBackground
          closeInboxDrawer={overlays.closeInboxDrawer}
          inboxDrawerOpen={overlays.inboxDrawerOpen}
          login={user.login}
        />
        <SignOutQuestion
          onConfirm={signOut.confirm}
          onDismiss={signOut.dismiss}
          open={signOut.asking}
          question={signOut.question}
        />
      </ShellFrame>
    </ShellProviders>
  );
}
