import { InboxDrawer } from "@upstream-dispatch/features/inbox/InboxDrawer";
import { CreateIssueDialog } from "@upstream-dispatch/features/issue/CreateIssueDialog";
import { RefPreviewHost } from "@upstream-dispatch/features/refs/RefPreview";
import { SearchPalette } from "@upstream-dispatch/features/search/SearchPalette";
import { ShortcutsSheet } from "@/commands/shortcuts-sheet";
import type { ShortcutsSheetState } from "@/commands/use-shortcuts-sheet";

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
