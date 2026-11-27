import { act } from "react";

/** Lets timers and renders run, 10 ms at a time, until `done` holds; throws after 400 ms. */
export async function until(done: () => boolean): Promise<void> {
  for (let tries = 0; tries < 40; tries += 1) {
    if (done()) return;
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  if (!done()) throw new Error(`waited 400 ms and this never held: ${done}`);
}
