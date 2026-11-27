import {
  ShortcutsSheet,
  type ShortcutSection as ShownSection,
} from "@legion/ui/blocks/shortcuts-sheet";
import { useMemo } from "react";

import { rowChips } from "./key-chips";
import type { ShortcutSection } from "./live-shortcuts";

/** The sections as the sheet shows them: each key as its chips on this platform. */
export function shownSections(sections: readonly ShortcutSection[], mac: boolean): ShownSection[] {
  return sections.map(({ group, rows }) => ({
    id: group.id,
    label: group.label,
    rows: rows.map((row) => ({ id: row.id, label: row.label, keys: rowChips(row.keys, mac) })),
  }));
}

export interface ShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly ShortcutSection[];
  /** The reader is on a Mac, which shows `⌘` where another platform shows `Ctrl`. */
  mac: boolean;
}

/** Every key that runs where `?` was pressed, grouped, with a filter. Loaded on the first `?`. */
export function ShortcutsSheetView({ open, onOpenChange, sections, mac }: ShortcutsSheetProps) {
  const shown = useMemo(() => shownSections(sections, mac), [sections, mac]);
  return (
    <ShortcutsSheet
      description="The keys that work right now."
      onOpenChange={onOpenChange}
      open={open}
      sections={shown}
    />
  );
}
