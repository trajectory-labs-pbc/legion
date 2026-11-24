import { appKeymap } from "@upstream-dispatch/features/shell/keymap";
import { useCallback, useMemo, useRef, useState } from "react";

import { Heading } from "@/ui/heading";
import { Input } from "@/ui/input";
import { KbdSequence } from "@/ui/kbd";
import { textVariants } from "@/ui/lib/typography";
import { cn } from "@/ui/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/ui/sheet";
import { appCatalog } from "./app-catalog";
import { chipsOf } from "./chips";
import { appStack } from "./engine-stack";
import { filterShortcuts, liveShortcuts, type ShortcutSection } from "./shortcuts";

/** The keys that run now, below anything the sheet itself opens. */
export function readLiveShortcuts(): ShortcutSection[] {
  return liveShortcuts(appKeymap.describe(), appStack.liveScopes(), appCatalog);
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
  // Every change goes through setOpen, so the ref always holds the state's open.
  const isOpen = useRef(false);
  const setOpen = useCallback(
    (open: boolean) => {
      isOpen.current = open;
      if (open) setState({ open, sections: read() });
      else setState((current) => ({ ...current, open }));
    },
    [read]
  );
  const toggle = useCallback(() => setOpen(!isOpen.current), [setOpen]);
  return { ...state, setOpen, toggle };
}

export interface ShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly ShortcutSection[];
}

/** Every key that runs where `?` was pressed, grouped, with a filter. */
export function ShortcutsSheet({ open, onOpenChange, sections }: ShortcutsSheetProps) {
  // Focus starts on the sheet itself, where `?` and Escape still reach the keys; the filter is a Tab away.
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel="Close the shortcuts" initialFocus={popup} ref={popup} side="right">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>The keys that work here, where you pressed ?</SheetDescription>
        </SheetHeader>
        <ShortcutsList sections={sections} />
      </SheetContent>
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so the filter starts empty each time. */
function ShortcutsList({ sections }: { sections: readonly ShortcutSection[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterShortcuts(sections, query), [sections, query]);
  return (
    <>
      <div className="px-4">
        <Input
          aria-label="Filter shortcuts"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter shortcuts"
          type="search"
          value={query}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {shown.length === 0 ? (
          <p className={cn(textVariants({ tone: "muted" }), "py-10 text-center")}>
            {query.trim() === "" ? "No key works here." : `No shortcut matches “${query.trim()}”.`}
          </p>
        ) : (
          shown.map(({ group, rows }) => (
            <section className="mb-5 last:mb-0" key={group.id}>
              <Heading className="mb-1" size="label" tone="muted">
                {group.label}
              </Heading>
              <ul>
                {rows.map((row) => (
                  <li
                    className={cn(
                      textVariants(),
                      "flex items-center justify-between gap-4 rounded-md py-1.5"
                    )}
                    key={row.id}
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1">
                      {row.keys.map((keys, index) => (
                        <span className="inline-flex items-center gap-1" key={keys}>
                          {index > 0 ? (
                            <span className={textVariants({ size: "caption", tone: "muted" })}>
                              or
                            </span>
                          ) : null}
                          <KbdSequence chips={chipsOf(keys)} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}
