import { Heading } from "@legion/ui/components/heading";
import { Input } from "@legion/ui/components/input";
import { KbdSequence } from "@legion/ui/components/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@legion/ui/components/sheet";
import { textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import { useMemo, useRef, useState } from "react";
import { rowChips } from "./key-chips";
import type { ShortcutSection } from "./live-shortcuts";

/** The rows whose label holds the query, any case; a section left empty goes. */
export function filterShortcuts(
  sections: readonly ShortcutSection[],
  query: string
): ShortcutSection[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...sections];
  return sections
    .map(({ group, rows }) => ({
      group,
      rows: rows.filter((row) => row.label.toLowerCase().includes(needle)),
    }))
    .filter(({ rows }) => rows.length > 0);
}

export interface ShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly ShortcutSection[];
}

/** Every key that runs where `?` was pressed, grouped, with a filter. Loaded on the first `?`. */
export function ShortcutsSheetView({ open, onOpenChange, sections }: ShortcutsSheetProps) {
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
                      {rowChips(row.keys).map((chips, index) => (
                        <span className="inline-flex items-center gap-1" key={chips.join(" ")}>
                          {index > 0 ? (
                            <span className={textVariants({ size: "caption", tone: "muted" })}>
                              or
                            </span>
                          ) : null}
                          <KbdSequence chips={chips} />
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
