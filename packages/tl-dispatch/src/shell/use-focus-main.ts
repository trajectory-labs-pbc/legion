import { type RefObject, useEffect, useRef } from "react";

import type { PageLayout } from "@/pages/page";

/** One page for focus: an issue's tabs are one page, and so are a project's views. */
export function pageIdentityOf(layout: PageLayout, pathname: string): string {
  return layout.issue ?? layout.project ?? pathname;
}

/** Moves focus to `main` when another page opens, so a screen reader starts on it. */
export function useFocusMainOnPageChange(
  main: RefObject<HTMLElement | null>,
  identity: string
): void {
  const shown = useRef(identity);
  useEffect(() => {
    if (shown.current === identity) return;
    shown.current = identity;
    main.current?.focus();
  }, [identity, main]);
}
