import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "#registry/legion/ui/breadcrumb";

describe("Breadcrumb", () => {
  it("is a named navigation whose links take the keyboard in order", async () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#home">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="#issues">Issues</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeDefined();
    expect(screen.getByText("More")).toBeDefined();
    expect(screen.getByText("Current").getAttribute("aria-current")).toBe("page");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Home" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Issues" }));
  });
});
