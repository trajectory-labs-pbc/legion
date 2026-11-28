import { useEffect } from "react";
import { ShortcutsSheet } from "@/commands/shortcuts-sheet";
import type { ShortcutsSheetState } from "@/commands/use-shortcuts-sheet";
import { lazyRegion } from "@/loading/lazy-region";
import { InboxDrawer } from "@/upstream/widgets/inbox-drawer";
import { RefPreviewHost } from "@/upstream/widgets/ref-preview";
import { SearchPalette } from "@/upstream/widgets/search-palette";

const loadCreate = () => import("@/upstream/widgets/create-issue");
// Drawn only while open, so each open starts a fresh draft: a region, not an overlay.
const CreateIssueDialog = lazyRegion("a new issue", loadCreate, "CreateIssueDialog");

/** Search, the inbox drawer, the shortcuts sheet, a new issue and the reference previews. */
export function ShellDialogs({
  closeCreate,
  closeInboxDrawer,
  closeSearch,
  createOpen,
  inboxDrawerOpen,
  searchOpen,
  shortcuts,
}: {
  closeCreate: () => void;
  closeInboxDrawer: () => void;
  closeSearch: () => void;
  createOpen: boolean;
  inboxDrawerOpen: boolean;
  searchOpen: boolean;
  shortcuts: ShortcutsSheetState;
}) {
  useEffect(() => {
    // Out of the entry chunk, but loaded with the shell, so `c` opens it at once. A failed load
    // fails the open too, which shows it.
    void loadCreate().catch(() => undefined);
  }, []);
  return (
    <>
      <SearchPalette onClose={closeSearch} open={searchOpen} />
      <InboxDrawer onClose={closeInboxDrawer} open={inboxDrawerOpen} />
      <ShortcutsSheet
        onOpenChange={shortcuts.setOpen}
        open={shortcuts.open}
        sections={shortcuts.sections}
      />
      {createOpen ? <CreateIssueDialog onClose={closeCreate} /> : null}
      <RefPreviewHost surface="reference-hover-card" />
    </>
  );
}
