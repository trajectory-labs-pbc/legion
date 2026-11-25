import { NavSurface } from "@legion/ui/components/nav";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { IconRail } from "@upstream-dispatch/features/issue-page/IconRail";
import type { ReactNode } from "react";
import { CommandButton } from "@/commands/command-button";

/** The issue frame's icon rail, the folded sidebar's rail, or the sidebar; none in a drawer. */
export function SidebarRegion({
  children,
  folded,
  inDrawer,
  issueRail,
  navigationOpen,
  onOpenNavigation,
  project,
  user,
}: {
  children: ReactNode;
  /** The reader folded the sidebar to its rail. */
  folded: boolean;
  /** The navigation is a drawer, so no sidebar is drawn. */
  inDrawer: boolean;
  /** The issue frame's icon rail takes the sidebar's place. */
  issueRail: boolean;
  navigationOpen: boolean;
  onOpenNavigation: () => void;
  project: string | undefined;
  user: AuthenticatedUser;
}) {
  const inboxCount = useInboxCount();
  if (issueRail) {
    return (
      <IconRail
        inboxCount={inboxCount}
        navigationOpen={navigationOpen}
        onOpenNavigation={onOpenNavigation}
        project={project}
        user={user}
      />
    );
  }
  if (inDrawer) return null;
  return folded ? (
    <NavSurface
      aria-label="Collapsed sidebar"
      className="fixed inset-y-0 left-0 z-10 flex w-14 justify-center p-2"
      data-testid="sidebar-rail"
    >
      <CommandButton
        commandId="global.toggle-sidebar"
        label="Show sidebar"
        size="icon-sm"
        tooltipSide="right"
      />
    </NavSurface>
  ) : (
    <NavSurface
      aria-label="Navigation"
      className="relative order-1 w-60 shrink-0 [overflow-anchor:none]"
      data-testid="sidebar"
    >
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-2">{children}</div>
    </NavSurface>
  );
}
