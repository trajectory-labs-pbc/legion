import { act } from "react";

/**
 * Waits, inside `act`, for the chunks the shell itself draws lazily: upstream's margin and the
 * account's menu. A test that ends while one loads would let it arrive outside `act`, in that
 * test or the next file's.
 */
export function shellChunksArrive(): Promise<void> {
  return act(async () => {
    await import("@upstream-dispatch/features/margin/Margin");
    await import("@/shell/account-menu");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}
