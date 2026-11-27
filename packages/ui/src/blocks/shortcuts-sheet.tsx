import { cn } from "cn";
import { useMemo, useRef, useState } from "react";
import { textVariants } from "#registry/legion/lib/typography";
import { Heading } from "#registry/legion/ui/heading";
import { Input } from "#registry/legion/ui/input";
import { KbdSequence, type KeySteps } from "#registry/legion/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#registry/legion/ui/sheet";

/** One action and each key that runs it, a key as its steps: `[["Ctrl", "K"]]`, or `[["G"], ["I"]]`. */
interface ShortcutRow {
  id: string;
  label: string;
  keys: readonly KeySteps[];
}

interface ShortcutSection {
  id: string;
  label: string;
  rows: readonly ShortcutRow[];
}

/** The rows whose label holds the query, any case; a section left empty goes. */
function filterShortcuts(sections: readonly ShortcutSection[], query: string): ShortcutSection[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...sections];
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => row.label.toLowerCase().includes(needle)),
    }))
    .filter(({ rows }) => rows.length > 0);
}

interface ShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly ShortcutSection[];
  /** Where the keys work, under the title: `The keys that work right now.` */
  description: string;
}

/** A sheet that lists keys by section, with a filter. Its list scrolls inside the sheet. */
function ShortcutsSheet({ open, onOpenChange, sections, description }: ShortcutsSheetProps) {
  // Focus starts on the sheet itself, where its own keys still reach; the filter is a Tab away.
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel="Close the shortcuts" initialFocus={popup} ref={popup} side="right">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
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
      <div data-slot="shortcuts-list" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {shown.length === 0 ? (
          <p className={cn(textVariants({ tone: "muted" }), "py-10 text-center")}>
            {query.trim() === "" ? "No key works here." : `No shortcut matches “${query.trim()}”.`}
          </p>
        ) : (
          shown.map((section) => (
            <section className="mb-5 last:mb-0" key={section.id}>
              <Heading className="mb-1" size="label" tone="muted">
                {section.label}
              </Heading>
              <ul>
                {section.rows.map((row) => (
                  <li
                    className={cn(textVariants(), "flex items-center justify-between gap-4 py-1.5")}
                    key={row.id}
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="flex max-w-1/2 shrink-0 flex-wrap justify-end gap-1">
                      {row.keys.map((steps, index) => (
                        <span
                          className="inline-flex items-center gap-1"
                          key={steps.map((step) => step.join("+")).join(" ")}
                        >
                          {index > 0 ? (
                            <span className={textVariants({ size: "caption", tone: "muted" })}>
                              or
                            </span>
                          ) : null}
                          <KbdSequence steps={steps} />
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

export {
  filterShortcuts,
  type ShortcutRow,
  type ShortcutSection,
  ShortcutsSheet,
  type ShortcutsSheetProps,
};
