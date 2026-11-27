import { act } from "@testing-library/react";

// Testing Library is the one render harness, cleaned up after each test; these names stay for
// the tests that still import them.
export { render } from "@testing-library/react";

/** Runs `change` inside React's `act`, so the renders it causes land before the next line. */
export function settle(change: () => void): void {
  act(change);
}
