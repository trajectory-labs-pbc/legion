import { cn } from "cn";
import { type ComponentProps, type ReactNode, useId } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { Heading } from "#registry/legion/ui/heading";
import { Text } from "#registry/legion/ui/text";
import { TruncatedText } from "#registry/legion/ui/truncated-text";

/** Metric cards in columns that follow the grid's own width, not the window's: one, then two,
 *  three or six where each card keeps 13.25rem (212 px) beside the 12 px gaps. */
function MetricGrid({
  label,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "aria-label" | "role"> & {
  /** Names the cards as one group, such as "KPI targets". */
  label?: string;
}) {
  return (
    <div
      className={cn("@container", className)}
      data-slot="metric-grid"
      {...(label === undefined ? {} : { "aria-label": label, role: "group" })}
      {...props}
    >
      <div className="grid grid-cols-1 gap-3 @min-[27.25rem]:grid-cols-2 @min-[41.25rem]:grid-cols-3 @min-[83.25rem]:grid-cols-6">
        {children}
      </div>
    </div>
  );
}

/** One summary block (SU3): a region named by its title, with a one-line detail under it, a mark
 *  at its right, and its figures and bars below. */
function MetricCard({
  title,
  detail,
  end,
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  /** One line under the title; cut to the card, in full in a tooltip. */
  detail?: string;
  /** A mark at the title's right, such as a verdict badge. */
  end?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3",
        className
      )}
      data-slot="metric-card"
      {...props}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Heading id={titleId} size="group">
            {title}
          </Heading>
          {detail === undefined ? null : (
            <Text render={<p />} size="caption" tone="muted">
              <TruncatedText text={detail} />
            </Text>
          )}
        </div>
        {isDrawn(end) ? <div className="flex shrink-0 items-center">{end}</div> : null}
      </div>
      {children}
    </section>
  );
}

const MUTED_CAPTION = textVariants({ size: "caption", tone: "muted" });

/** A metric's number: its label, the value with its unit word, and a second line. Without a
 *  label (the card's title names the value) it draws the same lines with no term. */
function MetricFigure({
  label,
  value,
  unit,
  secondary,
}: {
  label?: ReactNode;
  value: ReactNode;
  /** A word after the value, such as "median". */
  unit?: ReactNode;
  /** A line under the value, such as a count or a second number. */
  secondary?: ReactNode;
}) {
  const termed = isDrawn(label);
  const List = termed ? "dl" : "div";
  const Value = termed ? "dd" : "div";
  return (
    <List className="min-w-0" data-slot="metric-figure">
      {termed ? <dt className={MUTED_CAPTION}>{label}</dt> : null}
      <Value className="flex min-w-0 items-baseline gap-1">
        <span className={textVariants({ size: "figure" })}>{value}</span>
        {isDrawn(unit) ? <span className={MUTED_CAPTION}>{unit}</span> : null}
      </Value>
      {isDrawn(secondary) ? <Value className={MUTED_CAPTION}>{secondary}</Value> : null}
    </List>
  );
}

export { MetricCard, MetricFigure, MetricGrid };
