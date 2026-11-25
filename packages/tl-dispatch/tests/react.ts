import { act } from "@testing-library/react";

// Testing Library is the one render harness, cleaned up after each test; `settle` runs a change
// inside React's `act`, so the renders it causes land before the next line.
export { act as settle, render } from "@testing-library/react";

/** Waits `ms` inside React's `act`, so timers and the renders they cause land first. */
export const sleep = (ms: number) =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
