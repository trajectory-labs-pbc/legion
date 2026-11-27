import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";

interface ListRowProps extends Omit<ComponentProps<"div">, "children" | "title"> {
  /** Line one, at weight 500; it truncates. */
  title: ReactNode;
  /** Line two, muted. With it the row has two lines and is 56 px; without it, one line and 36 px. */
  description?: ReactNode;
  /** The row's glyph or avatar at its left. */
  leading?: ReactNode;
  /** The selection box: it takes the leading part's place while the pointer is near the row's left
   *  edge, and while `selecting` (LR6). It sits beside the row's content, not in it, so its click
   *  and its keys never reach the content; a list's key handlers ignore events from inside it
   *  (`[data-slot=list-row-select]`). */
  select?: ReactNode;
  /** A selection exists in the list, so each row shows its box. */
  selecting?: boolean;
  /** At the right of line one: the properties, the unread dot, the time. */
  end?: ReactNode;
  /** At the right of line two. */
  descriptionEnd?: ReactNode;
  /** The row's content, which the whole row opens: a link or a button (LR4). */
  render?: useRender.RenderProp;
}

/** A list's row: one line at 36 px, or two at 56 px, and no edge or card around it (LR1, R2). The
 *  caller marks it with `data-highlighted` and `data-selected`, and with `aria-selected` where the
 *  row is an option. */
function ListRow({
  title,
  description,
  leading,
  select,
  selecting = false,
  end,
  descriptionEnd,
  render,
  className,
  ...props
}: ListRowProps) {
  const twoLines = isDrawn(description);
  const content = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "list-row-content",
      // Its click area and its focus outline cover the row; the outline is inside it (FO2).
      className:
        "flex min-w-0 flex-1 flex-col justify-center text-left outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-focus",
      children: (
        <>
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn(textVariants({ weight: "medium" }), "min-w-0 truncate")}>
              {title}
            </span>
            {isDrawn(end) ? (
              <span className="ml-auto flex shrink-0 items-center gap-2">{end}</span>
            ) : null}
          </span>
          {twoLines ? (
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(textVariants({ size: "caption", tone: "muted" }), "min-w-0 truncate")}
              >
                {description}
              </span>
              {isDrawn(descriptionEnd) ? (
                <span className="ml-auto flex shrink-0 items-center gap-2">{descriptionEnd}</span>
              ) : null}
            </span>
          ) : null}
        </>
      ),
    },
  });
  const hasSelect = isDrawn(select);
  return (
    <div
      className={cn(
        "group/list-row relative flex w-full min-w-0 shrink-0 items-stretch gap-2 px-3",
        twoLines ? "h-list-row-2" : "h-list-row-1",
        "data-highlighted:bg-secondary data-selected:bg-muted data-selected:data-highlighted:bg-accent",
        className
      )}
      data-selecting={selecting ? "" : undefined}
      data-slot="list-row"
      {...props}
    >
      {isDrawn(leading) || hasSelect ? (
        // The row's left edge, padding included: the pointer on it shows the box.
        <span className="group/list-row-start relative z-10 -ml-3 grid shrink-0 place-items-center pl-3 *:col-start-1 *:row-start-1">
          {isDrawn(leading) ? (
            <span
              className={cn(
                "flex",
                hasSelect &&
                  "group-hover/list-row-start:invisible group-data-selecting/list-row:invisible"
              )}
            >
              {leading}
            </span>
          ) : null}
          {hasSelect ? (
            <span
              className="invisible flex group-hover/list-row-start:visible group-data-selecting/list-row:visible"
              data-slot="list-row-select"
            >
              {select}
            </span>
          ) : null}
        </span>
      ) : null}
      {content}
    </div>
  );
}

export { ListRow, type ListRowProps };
