import { appKeymap } from "@upstream-dispatch/features/shell/keymap";
import { lazy, Suspense, useCallback, useState } from "react";

import { appCatalog, UPSTREAM_LABELS } from "./app-catalog";
import { appStack } from "./engine-stack";
import { liveShortcuts, type ShortcutSection } from "./shortcuts";
import type { ShortcutsSheetProps } from "./shortcuts-sheet-view";

/** The keys that run now, below anything the sheet itself opens. */
export function readLiveShortcuts(): ShortcutSection[] {
  return liveShortcuts(appKeymap.describe(), appStack.liveScopes(), appCatalog, UPSTREAM_LABELS);
}

export interface ShortcutsSheetState {
  open: boolean;
  /** The keys read when the sheet last opened. */
  sections: readonly ShortcutSection[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * The sheet's state. Opening reads the live keys at that moment, before the sheet's own layer
 * covers them: the engine evaluates each gate as it is read.
 */
export function useShortcutsSheet(
  read: () => readonly ShortcutSection[] = readLiveShortcuts
): ShortcutsSheetState {
  const [state, setState] = useState<{ open: boolean; sections: readonly ShortcutSection[] }>({
    open: false,
    sections: [],
  });
  const setOpen = useCallback(
    (open: boolean) => {
      if (open) setState({ open, sections: read() });
      else setState((current) => ({ ...current, open }));
    },
    [read]
  );
  // The key reads the last commit's toggle, so this open is the one on screen.
  const toggle = useCallback(() => setOpen(!state.open), [setOpen, state.open]);
  return { ...state, setOpen, toggle };
}

const ShortcutsSheetView = lazy(() =>
  import("./shortcuts-sheet-view").then((module) => ({ default: module.ShortcutsSheet }))
);

/** The shortcuts sheet, whose code loads the first time it opens and stays for its close. */
export function ShortcutsSheet(props: ShortcutsSheetProps) {
  const [opened, setOpened] = useState(false);
  if (props.open && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <ShortcutsSheetView {...props} />
    </Suspense>
  );
}
