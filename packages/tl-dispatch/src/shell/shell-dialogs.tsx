import { useEffect } from "react";
import { ShortcutsSheet } from "@/commands/shortcuts-sheet";
import type { ShortcutsSheetState } from "@/commands/use-shortcuts-sheet";
import { lazyRegion } from "@/loading/lazy-region";
import { SearchPalette } from "@/upstream/widgets/search-palette";

const loadCreate = () => import("@/upstream/widgets/create-issue");
// Drawn only while open, so each open starts a fresh draft: a region, not an overlay.
const CreateIssueDialog = lazyRegion("a new issue", loadCreate, "CreateIssueDialog");

/** Search, the shortcuts sheet and a new issue. */
export function ShellDialogs({
  closeCreate,
  closeSearch,
  createOpen,
  searchOpen,
  shortcuts,
}: {
  closeCreate: () => void;
  closeSearch: () => void;
  createOpen: boolean;
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
      <ShortcutsSheet
        onOpenChange={shortcuts.setOpen}
        open={shortcuts.open}
        sections={shortcuts.sections}
      />
      {createOpen ? <CreateIssueDialog onClose={closeCreate} /> : null}
    </>
  );
}
