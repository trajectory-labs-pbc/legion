import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { RecordHeader } from "#registry/legion/blocks/record-header";
import { OverlayOutline } from "#registry/legion/ui/heading";

const breadcrumb = (
  <nav aria-label="Breadcrumb">
    <a href="/machines">Machines</a>
  </nav>
);

const classes = (element: Element | null | undefined) => element?.className.split(" ") ?? [];

describe("RecordHeader", () => {
  it("with a breadcrumb, is a 44 px bar with a line under it, the breadcrumb then the end, then the h1", () => {
    const { container } = render(
      <RecordHeader
        breadcrumb={breadcrumb}
        end={<button type="button">More</button>}
        title="build-07"
      />
    );
    const header = container.querySelector("header");
    const bar = header?.firstElementChild;
    expect(classes(bar)).toEqual(expect.arrayContaining(["h-11", "border-b"]));
    expect(bar?.textContent).toBe("MachinesMore");
    expect(classes(screen.getByRole("button", { name: "More" }).parentElement)).toContain(
      "ml-auto"
    );
    const title = screen.getByRole("heading", { level: 1 });
    expect(bar?.contains(title)).toBe(false);
    expect(header?.lastElementChild?.contains(title)).toBe(true);
  });

  it("without a breadcrumb, draws the title in the bar with the end beside it", () => {
    const { container } = render(
      <RecordHeader end={<button type="button">More</button>} title="planner" />
    );
    const header = container.querySelector("header");
    expect(classes(header)).toEqual(expect.arrayContaining(["min-h-11", "border-b"]));
    expect(classes(header)).not.toContain("h-11");
    expect(header?.children).toHaveLength(2);
    expect(header?.firstElementChild?.contains(screen.getByRole("heading", { level: 1 }))).toBe(
      true
    );
    expect(header?.lastElementChild).toBe(
      screen.getByRole("button", { name: "More" }).parentElement
    );
  });

  it("wraps a long title at 20 px and never truncates it", () => {
    render(<RecordHeader title="A name long enough to need a second line" />);
    const title = classes(screen.getByRole("heading", { level: 1 }));
    expect(title).toEqual(expect.arrayContaining(["text-xl", "wrap-anywhere", "min-w-0"]));
    expect(title).not.toContain("truncate");
  });

  it("draws the glyph before the title and outside its name", () => {
    render(<RecordHeader leading={<svg aria-label="Running" role="img" />} title="planner" />);
    const title = screen.getByRole("heading", { level: 1 });
    const glyph = screen.getByRole("img", { name: "Running" });
    expect(title.textContent).toBe("planner");
    expect(title.contains(glyph)).toBe(false);
    expect(glyph.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is a peek's h2 inside an overlay", () => {
    render(
      <OverlayOutline>
        <RecordHeader title="planner" />
      </OverlayOutline>
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("planner");
  });
});
