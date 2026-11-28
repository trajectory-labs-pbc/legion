import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

/** How long a timeline may run before it ends unfinished. */
const TIMEOUT_MS = 1_500;

/** One change of what a render shows: its name, and how many ms after the render it came. */
export interface Change {
  state: string;
  at: number;
}

/** Whether `host` shows an element `selector` matches: Suspense hides what it keeps with `display: none`. */
export function shows(host: HTMLElement, selector: string): boolean {
  return [...host.querySelectorAll(selector)].some(
    (element) => element.closest('[style*="display: none"]') === null
  );
}

/**
 * Renders `node` outside React's `act`, on real timers, as the browser runs it: `act` skips
 * React's 300 ms Suspense fallback throttle. Records each change `stateOf` names, timed in the
 * microtask after the DOM changed, until `done` answers true or 1.5 s pass. With `sync`, the
 * render commits at once, as a click's does, so the first change is the first commit.
 */
export async function changesOutsideAct(
  node: ReactNode,
  stateOf: (host: HTMLElement) => string,
  {
    done,
    onChange,
    sync = false,
  }: { done: (state: string) => boolean; onChange?: (change: Change) => void; sync?: boolean }
): Promise<Change[]> {
  const actEnvironment: unknown = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const changes: Change[] = [];
  const finished = Promise.withResolvers<void>();
  const start = performance.now();
  const record = () => {
    const state = stateOf(host);
    if (state === changes.at(-1)?.state) return;
    const change = { state, at: performance.now() - start };
    changes.push(change);
    onChange?.(change);
    if (done(state)) finished.resolve();
  };
  const observer = new MutationObserver(record);
  observer.observe(host, { attributes: true, characterData: true, childList: true, subtree: true });
  const timeout = setTimeout(finished.resolve, TIMEOUT_MS);
  try {
    if (sync) flushSync(() => root.render(node));
    else root.render(node);
    record();
    await finished.promise;
  } finally {
    clearTimeout(timeout);
    observer.disconnect();
    root.unmount();
    host.remove();
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", actEnvironment);
  }
  return changes;
}
