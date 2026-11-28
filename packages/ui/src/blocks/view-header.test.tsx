import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { ViewHeader } from "#registry/legion/blocks/view-header";

describe("ViewHeader", () => {
  it("is one 44 px row with a line under it: the control, the h1, the count, the tabs, then the end", () => {
    const { container } = render(
      <ViewHeader
        count={12}
        end={<button type="button">Display</button>}
        start={<button type="button">Show sidebar</button>}
        tabs={<a href="/answers">Answered by you</a>}
        title="Inbox"
      />
    );
    const header = container.querySelector("header");
    expect(header?.className).toContain("h-11");
    expect(header?.className).toContain("border-b");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Inbox");
    expect(header?.textContent).toBe("Show sidebarInbox12Answered by youDisplay");
    expect(screen.getByRole("button", { name: "Display" }).parentElement?.className).toContain(
      "ml-auto"
    );
  });

  it.each([undefined, false])("draws only its title when its other slots are %p", (empty) => {
    const { container } = render(<ViewHeader count={0} end={empty} tabs={empty} title="Inbox" />);
    expect(container.querySelector("header")?.children).toHaveLength(1);
  });

  it("clips the tabs, so they never paint over the end controls", () => {
    render(
      <ViewHeader
        end={<button type="button">Display</button>}
        tabs={<a href="/x">Tab</a>}
        title="Inbox"
      />
    );
    expect(screen.getByRole("link", { name: "Tab" }).parentElement?.className).toContain(
      "overflow-hidden"
    );
  });
});
