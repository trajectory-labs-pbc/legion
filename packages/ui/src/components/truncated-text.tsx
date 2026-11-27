import { useCallback, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "#registry/legion/ui/tooltip";

const TEXT = "block w-full truncate text-left";

/** Text cut to its box, shown in full in a tooltip. While the text is cut it is a button, so the
 *  keyboard reaches it and opens the tooltip too; text that fits is plain text, with no tooltip.
 *  In a table cell, give the cell `max-w-0` and a share of the width, so the text takes what the
 *  other columns leave. */
function TruncatedText({ text }: { text: string }) {
  const [cut, setCut] = useState(false);
  // Each element drawn is measured, and again whenever its width changes.
  const measure = useCallback((element: HTMLElement | null) => {
    if (element === null) return;
    const check = () => setCut(element.scrollWidth > element.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // New text is a new element, so it is measured anew.
  if (!cut) {
    return (
      <span className={TEXT} data-slot="truncated-text" key={text} ref={measure}>
        {text}
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        key={text}
        ref={measure}
        data-slot="truncated-text"
        render={
          <button
            className={`${TEXT} rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
            type="button"
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent className="max-w-(--available-width) wrap-anywhere">{text}</TooltipContent>
    </Tooltip>
  );
}

export { TruncatedText };
