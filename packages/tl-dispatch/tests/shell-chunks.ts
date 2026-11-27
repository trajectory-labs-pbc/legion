import { act } from "react";

/**
 * Waits, inside `act`, for code that loads lazily, so it never arrives after the test, outside
 * `act`, in that test or the next file's.
 */
export function chunksArrive(...loads: (() => Promise<unknown>)[]): Promise<void> {
  return act(async () => {
    for (const load of loads) await load();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

/** The chunks the shell itself draws lazily: upstream's margin and the account's menu. */
export const shellChunksArrive = () =>
  chunksArrive(
    () => import("@upstream-dispatch/features/margin/Margin"),
    () => import("@/shell/account-menu")
  );
