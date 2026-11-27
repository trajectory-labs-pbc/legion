import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import type { ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";

interface ListRowProps {
  /** Line one, at weight 500; it truncates. */
  title: ReactNode;
  /** Line two, muted. With it the row has two lines and is 56 px; without it, one line and 36 px. */
  description?: ReactNode;
  /** The row's glyph or avatar at its left. */
  leading?: ReactNode;
  /** The selection box: it takes the leading part's place on hover, on focus and while
   *  `selecting`, and a click on it does not reach the row. */
  select?: ReactNode;
  /** A selection exists in the list, so each row shows its box. */
  selecting?: boolean;
  /** At the right of the last line, such as the row's time. */
  end?: ReactNode;
  /** A dot before the title, named by this label. */
  dot?: string;
  /** The list's one highlight is on this row. */
  highlighted?: boolean;
  selected?: boolean;
}

// The box shows in the leading part's place while the row is hovered, focused or in a selection.
const SHOW_SELECT =
  "group-hover/list-row:visible group-focus-within/list-row:visible group-data-selecting/list-row:visible";
const HIDE_LEADING =
  "group-hover/list-row:invisible group-focus-within/list-row:invisible group-data-selecting/list-row:invisible";

/** A list's row: one line at 36 px, or two at 56 px, and no edge or card around it (LR1, R2). */
function ListRow({
  title,
  description,
  leading,
  select,
  selecting = false,
  end,
  dot,
  highlighted = false,
  selected = false,
  className,
  render,
  ...props
}: ListRowProps & Omit<useRender.ComponentProps<"div">, "title">) {
  const twoLines = isDrawn(description);
  const hasLeading = isDrawn(leading);
  const hasSelect = isDrawn(select);
  const endPart = isDrawn(end) ? (
    <span className="ml-auto flex shrink-0 items-center gap-2">{end}</span>
  ) : null;
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "list-row",
      "data-highlighted": highlighted ? "" : undefined,
      "data-selected": selected ? "" : undefined,
      "data-selecting": selecting || selected ? "" : undefined,
      className: cn(
        "group/list-row flex w-full min-w-0 shrink-0 items-center gap-2 px-3 text-left",
        twoLines ? "h-list-row-2" : "h-list-row-1",
        "data-highlighted:bg-secondary data-selected:bg-muted",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        className
      ),
      ...props,
      children: (
        <>
          {hasLeading || hasSelect ? (
            <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
              {hasLeading ? (
                <span className={cn("flex", hasSelect ? HIDE_LEADING : null)}>{leading}</span>
              ) : null}
              {hasSelect ? (
                // biome-ignore lint/a11y/noStaticElementInteractions: it only keeps the box's click from the row
                // biome-ignore lint/a11y/useKeyWithClickEvents: the box inside takes its own keys
                <span
                  className={cn("invisible flex", SHOW_SELECT)}
                  onClick={(event) => event.stopPropagation()}
                >
                  {select}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="flex min-w-0 items-center gap-2">
              {dot === undefined ? null : (
                <span
                  data-slot="list-row-dot"
                  aria-label={dot}
                  className="size-2 shrink-0 rounded-full bg-primary"
                  role="img"
                />
              )}
              <span className={cn(textVariants({ weight: "medium" }), "min-w-0 truncate")}>
                {title}
              </span>
              {twoLines ? null : endPart}
            </span>
            {twoLines ? (
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    textVariants({ size: "caption", tone: "muted" }),
                    "min-w-0 truncate"
                  )}
                >
                  {description}
                </span>
                {endPart}
              </span>
            ) : null}
          </span>
        </>
      ),
    },
  });
}

export { ListRow, type ListRowProps };
