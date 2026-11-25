import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Heading, HeadingSection, OverlayOutline, SurfaceTitle } from "#registry/legion/ui/heading";

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

  it("draws a page's title as the one h1 and an overlay's as an h2, in the size it is given", () => {
    render(
      <>
        <SurfaceTitle size="page">Machines</SurfaceTitle>
        <HeadingSection>
          <OverlayOutline>
            <SurfaceTitle size="section">Rename</SurfaceTitle>
          </OverlayOutline>
        </HeadingSection>
      </>
    );
    const page = screen.getByRole("heading", { name: "Machines" });
    expect(page.tagName).toBe("H1");
    expect(page.getAttribute("data-slot")).toBe("heading");
    expect(screen.getByRole("heading", { name: "Rename" }).tagName).toBe("H2");
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
