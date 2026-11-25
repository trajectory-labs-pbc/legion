import { act } from "react";

/**
 * Waits, inside `act`, for the chunk the shell itself draws lazily: upstream's margin. A test
 * that ends while it loads would let it arrive outside `act`, in that test or the next file's.
 */
export function shellChunksArrive(): Promise<void> {
  return act(async () => {
    await import("@upstream-dispatch/features/margin/Margin");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}
