import { cn } from "cn";
import { Children, createContext, type ReactNode, useContext } from "react";

import { headingVariants, textVariants } from "#registry/legion/lib/typography";
import { TruncatedText } from "#registry/legion/ui/truncated-text";

const StackedContext = createContext(false);

/** The value's text when every part of it is a string or a number (`{5} of {8}`), else null. */
function textOf(children: ReactNode): string | null {
  const parts = Children.toArray(children);
  const isText = parts.every((part) => typeof part === "string" || typeof part === "number");
  return parts.length > 0 && isText ? parts.join("") : null;
}

/** A record's properties, a description list (IV1, IV6): rows from 1024 px, and a row of chips
 *  below 1024 px. `RecordView` places it. With `stacked`, as in a peek, it is rows at every
 *  width. A page that hides the panel does not draw it. */
function PropertiesPanel({
  stacked = false,
  children,
}: {
  stacked?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Properties"
      className={stacked ? "border-b border-border py-2" : "py-2 max-lg:px-6"}
      data-slot="properties-panel"
    >
      <dl className={stacked ? undefined : "max-lg:flex max-lg:flex-wrap max-lg:gap-2"}>
        <StackedContext.Provider value={stacked}>{children}</StackedContext.Provider>
      </dl>
    </section>
  );
}

/** One property: a 32 px row with its label at the left and its value at the right, or a chip of
 *  the two below 1024 px. A value of strings and numbers is one line of text, cut with its full
 *  text in a tooltip (LR1); a value that is a part of its own, such as a link or a picker, keeps to
 *  one line itself. */
function Property({ label, children }: { label: string; children: ReactNode }) {
  const stacked = useContext(StackedContext);
  const text = textOf(children);
  return (
    <div
      className={cn(
        "flex h-row min-w-0 items-center gap-2 px-3",
        !stacked &&
          "max-lg:h-control-sm max-lg:gap-1.5 max-lg:rounded-badge max-lg:border max-lg:border-border max-lg:px-2"
      )}
      data-slot="property"
    >
      <dt
        className={cn(
          headingVariants({ size: "label", tone: "muted" }),
          "w-28 shrink-0 truncate",
          !stacked && "max-lg:w-auto"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(textVariants(), "flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap")}
      >
        {text === null ? children : <TruncatedText text={text} />}
      </dd>
    </div>
  );
}

export { PropertiesPanel, Property };
