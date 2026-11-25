import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Heading, HeadingSection, OverlayOutline } from "#registry/legion/ui/heading";

describe("Heading", () => {
  it("takes its level from the sections around it", () => {
    render(
      <>
        <Heading size="page">Page</Heading>
        <HeadingSection>
          <Heading size="section">Section</Heading>
          <HeadingSection>
            <Heading size="group">Group</Heading>
          </HeadingSection>
        </HeadingSection>
      </>
    );
    expect(screen.getByRole("heading", { name: "Page" }).tagName).toBe("H2");
    expect(screen.getByRole("heading", { name: "Section" }).tagName).toBe("H3");
    expect(screen.getByRole("heading", { name: "Group" }).tagName).toBe("H4");
  });

  it("ranks an overlay's body under the overlay's title, whatever level opened it", () => {
    render(
      <HeadingSection>
        <HeadingSection>
          <OverlayOutline>
            <Heading size="group">Fields</Heading>
          </OverlayOutline>
        </HeadingSection>
      </HeadingSection>
    );
    expect(screen.getByRole("heading", { name: "Fields" }).tagName).toBe("H3");
  });

  it("refuses an outline deeper than h6", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <HeadingSection>
          <HeadingSection>
            <HeadingSection>
              <HeadingSection>
                <HeadingSection>
                  <Heading size="group">Too deep</Heading>
                </HeadingSection>
              </HeadingSection>
            </HeadingSection>
          </HeadingSection>
        </HeadingSection>
      )
    ).toThrow("The heading outline is deeper than h6.");
    consoleError.mockRestore();
  });
});
