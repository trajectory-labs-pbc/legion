import { Button } from "@legion/ui/components/button";
import { Heading } from "@legion/ui/components/heading";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useUiPreferences } from "@/stores/ui-preferences";

/** A sidebar section under a heading that folds it; this browser keeps the fold. */
export function FoldSection({ children, heading }: { children: ReactNode; heading: string }) {
  const open = !useUiPreferences((s) => s.sidebarFolds[heading]);
  const toggleSidebarFold = useUiPreferences((s) => s.toggleSidebarFold);
  const bodyId = useId();
  return (
    <section>
      <Heading className="pb-1" size="label" tone="muted">
        <Button
          aria-controls={open ? bodyId : undefined}
          aria-expanded={open}
          onClick={() => toggleSidebarFold(heading)}
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
