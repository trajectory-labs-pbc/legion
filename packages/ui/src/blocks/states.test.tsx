import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { EmptyState, ErrorState, LoadingState } from "#registry/legion/blocks/states";

describe("EmptyState", () => {
  it("shows a muted icon, a one-line title, one sentence and its one action, across the width", () => {
    const { container } = render(
      <EmptyState
        action={<button type="button">Clear filters</button>}
        description="No row matches the filters that you chose."
        icon={<svg data-testid="icon" />}
        title="Nothing matches this filter"
      />
    );
    const state = container.querySelector("[data-slot=empty-state]");
    expect(state?.className).toContain("w-full");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Nothing matches this filter"
    );
    expect(screen.getByRole("heading").className).toContain("truncate");
    expect(screen.getByText("No row matches the filters that you chose.").tagName).toBe("P");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
    const icon = screen.getByTestId("icon").parentElement;
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.className).toContain("[&>svg]:size-8");
    expect(icon?.className).toContain("text-muted-foreground");
    expect(state?.getAttribute("role")).toBeNull();
  });

  it("draws no icon and no action when its caller gives none", () => {
    const { container } = render(
      <EmptyState description="New asks and replies for you show here." title="Nothing needs you" />
    );
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws no wrapper for a slot its caller sets to false", () => {
    const { container } = render(
      <EmptyState action={false} description="Nothing here." icon={false} title="Nothing" />
    );
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(container.querySelector("[data-slot=empty-state] > div")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("is announced as an alert, with its retry", () => {
    render(
      <ErrorState
        action={<button type="button">Retry</button>}
        description="The list did not load."
        title="Something went wrong"
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong");
    expect(alert.contains(screen.getByRole("button", { name: "Retry" }))).toBe(true);
  });
});

describe("LoadingState", () => {
  it("is a status named by its label, around its still placeholder", () => {
    render(
      <LoadingState label="Loading the list">
        <div data-testid="rows" />
      </LoadingState>
    );
    const status = screen.getByRole("status", { name: "Loading the list" });
    expect(status.hasAttribute("aria-busy")).toBe(false);
    expect(status.contains(screen.getByTestId("rows"))).toBe(true);
    expect(status.querySelector("[data-slot=spinner]")).toBeNull();
  });
});
