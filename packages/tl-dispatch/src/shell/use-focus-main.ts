import { parseIssuePath, parseProjectPath } from "@upstream-dispatch/features/refs/routes";
import { type RefObject, useEffect, useRef } from "react";

/** One page for focus: an issue's tabs are one page, and so are a project's views. */
export function pageIdentityOf(pathname: string): string {
  return parseIssuePath(pathname)?.key ?? parseProjectPath(pathname)?.project ?? pathname;
}

/** Moves focus to `main` when another page opens, so a screen reader starts on it. */
export function useFocusMainOnPageChange(
  main: RefObject<HTMLElement | null>,
  pathname: string
): void {
  const identity = pageIdentityOf(pathname);
  const shown = useRef(identity);
  useEffect(() => {
    if (shown.current === identity) return;
    shown.current = identity;
    main.current?.focus();
  }, [identity, main]);
}
