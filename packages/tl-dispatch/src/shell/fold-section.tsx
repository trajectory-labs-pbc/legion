import { Button } from "@legion/ui/components/button";
import { Heading } from "@legion/ui/components/heading";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

const foldKey = (heading: string) => `tl-dispatch.sidebar.folded.${heading}`;

function keptFolded(heading: string): boolean {
  try {
    return window.localStorage.getItem(foldKey(heading)) === "true";
  } catch {
    // A browser that refuses storage opens every section.
    return false;
  }
}

function keepFolded(heading: string, folded: boolean): void {
  try {
    if (folded) window.localStorage.setItem(foldKey(heading), "true");
    else window.localStorage.removeItem(foldKey(heading));
  } catch {
    // A browser that refuses storage keeps the fold until the sidebar mounts again.
  }
}

/** A sidebar section under a heading that folds it; this browser keeps the fold. */
export function FoldSection({ children, heading }: { children: ReactNode; heading: string }) {
  const [open, setOpen] = useState(() => !keptFolded(heading));
  const bodyId = useId();
  return (
    <section>
      <Heading className="pb-1" size="label" tone="muted">
        <Button
          aria-controls={open ? bodyId : undefined}
          aria-expanded={open}
          onClick={() => {
            const folding = open;
            setOpen(!folding);
            keepFolded(heading, folding);
          }}
          size="xs"
          variant="ghost"
        >
          {heading}
          {open ? (
            <ChevronDownIcon aria-hidden data-icon="inline-end" />
          ) : (
            <ChevronRightIcon aria-hidden data-icon="inline-end" />
          )}
        </Button>
      </Heading>
      {open ? <div id={bodyId}>{children}</div> : null}
    </section>
  );
}
