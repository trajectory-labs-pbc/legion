import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoadState } from "#registry/legion/ui/load-state";

const state = (props: { pending?: boolean; failed?: boolean; retrying?: boolean }) => {
  const onRetry = mock(() => {});
  render(
    <LoadState
      pending={props.pending ?? false}
      failed={props.failed ?? false}
      retrying={props.retrying}
      loading="Loading machines…"
      failure="Couldn't load machines."
      onRetry={onRetry}
    >
      <p>3 machines</p>
    </LoadState>
  );
  return onRetry;
};

describe("LoadState", () => {
  it("says the read is out, and draws no content", () => {
    state({ pending: true });
    expect(screen.getByText("Loading machines…")).toBeDefined();
    expect(screen.queryByText("3 machines")).toBeNull();
  });

  it("reports a failure as an alert, and Retry asks again", async () => {
    const onRetry = state({ failed: true });
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load machines.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("holds Retry while a retry is out", () => {
    state({ failed: true, retrying: true });
    expect(screen.getByRole("button", { name: "Retry" }).hasAttribute("disabled")).toBe(true);
  });

  it("draws the content once the read has answered", () => {
    state({});
    expect(screen.getByText("3 machines")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
