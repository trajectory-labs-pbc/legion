import { NavSurface } from "@legion/ui/components/nav";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { IconRail } from "@upstream-dispatch/features/issue-page/IconRail";
import type { ComponentProps, ReactNode, RefObject } from "react";
import { useInboxRowCount } from "./inbox-count";

/** Upstream's icon rail with the Inbox's number; only this branch reads it. */
function IssueRail(props: Omit<ComponentProps<typeof IconRail>, "inboxCount">) {
  return <IconRail inboxCount={useInboxRowCount().count ?? 0} {...props} />;
}

/** The issue frame's icon rail or the sidebar; none in a drawer or while folded. */
export function SidebarRegion({
  children,
  folded,
  inDrawer,
  issueRail,
  navigationOpen,
  onOpenNavigation,
  project,
  sidebarRef,
  user,
}: {
  children: ReactNode;
  /** The reader folded the sidebar away; the content panel's top row shows it again. */
  folded: boolean;
  /** The navigation is a drawer, so no sidebar is drawn. */
  inDrawer: boolean;
  /** The issue frame's icon rail takes the sidebar's place. */
  issueRail: boolean;
  navigationOpen: boolean;
  onOpenNavigation: () => void;
  project: string | undefined;
  sidebarRef: RefObject<HTMLElement | null>;
  user: AuthenticatedUser;
}) {
  if (issueRail) {
    return (
      <div className="contents" data-upstream-view>
        <IssueRail
          navigationOpen={navigationOpen}
          onOpenNavigation={onOpenNavigation}
          project={project}
          user={user}
        />
      </div>
    );
  }
  if (inDrawer || folded) return null;
  return (
    <NavSurface
      aria-label="Navigation"
      className="relative order-1 w-(--sidebar-width) shrink-0 [overflow-anchor:none]"
      data-testid="sidebar"
      ref={sidebarRef}
    >
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-2">{children}</div>
    </NavSurface>
  );
}
