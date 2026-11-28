import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { ReadBoundary, type ReadState } from "#registry/legion/blocks/read-boundary";

const PARTS: Record<ReadState, string> = {
  loading: "Loading",
  failed: "Failed",
  empty: "Empty",
  ready: "Rows",
};

describe("ReadBoundary", () => {
  it.each(Object.keys(PARTS) as ReadState[])("draws only the part for %s", (state) => {
    render(
      <ReadBoundary
        empty={<p>Empty</p>}
        failed={<p>Failed</p>}
        loading={<p>Loading</p>}
        state={state}
      >
        <p>Rows</p>
      </ReadBoundary>
    );
    const boundary = screen.getByText(PARTS[state]).parentElement;
    expect(boundary?.getAttribute("data-state")).toBe(state);
    expect(boundary?.textContent).toBe(PARTS[state]);
  });
});
