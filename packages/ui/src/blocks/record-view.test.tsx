import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecordView } from "#registry/legion/blocks/record-view";

const classes = (element: Element | null | undefined) => element?.className.split(" ") ?? [];

function view(panel: boolean) {
  return render(
    <RecordView
      header={<button type="button">Header action</button>}
      panel={panel ? <button type="button">Owner</button> : undefined}
    >
      <a href="/body">Body link</a>
    </RecordView>
  );
}

describe("RecordView", () => {
  it("orders the header, the panel, then the body, so Tab reaches the panel before the body", async () => {
    view(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Header action" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Owner" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Body link" }));
  });

  it("from 1024 px, runs the panel 280 px wide at the right from the header's top to the bottom", () => {
    const { container } = view(true);
    expect(classes(container.querySelector("[data-slot=record-view-panel]"))).toEqual(
      expect.arrayContaining([
        "lg:col-start-2",
        "lg:row-start-1",
        "lg:row-span-2",
        "lg:w-70",
        "lg:border-l",
        "lg:overflow-y-auto",
      ])
    );
    expect(classes(container.querySelector("[data-slot=record-view-body]"))).toEqual(
      expect.arrayContaining(["lg:col-start-1", "lg:row-start-2"])
    );
  });

  it("below 1024 px, puts the panel between the header and the body, with a line and a 12 px gap under it", () => {
    const { container } = view(true);
    expect(classes(container.querySelector("[data-slot=record-view-panel]"))).toEqual(
      expect.arrayContaining(["row-start-2", "max-lg:border-b", "max-lg:mb-3"])
    );
    expect(classes(container.querySelector("[data-slot=record-view-body]"))).toContain(
      "row-start-3"
    );
  });

  it("scrolls the body on its own", () => {
    const { container } = view(true);
    expect(classes(container.querySelector("[data-slot=record-view-body]"))).toEqual(
      expect.arrayContaining(["min-h-0", "overflow-y-auto"])
    );
  });

  it("draws no panel column while the page hides the panel, and no gap above the body", () => {
    const { container } = view(false);
    expect(container.querySelector("[data-slot=record-view-panel]")).toBeNull();
    const body = container.querySelector("[data-slot=record-view-body]");
    expect(body?.contains(screen.getByRole("link", { name: "Body link" }))).toBe(true);
    expect(classes(body).filter((name) => /(^|:)pt-/.test(name))).toEqual([]);
  });
});
