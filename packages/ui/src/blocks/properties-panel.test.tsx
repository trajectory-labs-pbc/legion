import { afterEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { PropertiesPanel, Property } from "#registry/legion/blocks/properties-panel";

function panel(stacked?: boolean) {
  return render(
    <PropertiesPanel stacked={stacked}>
      <Property label="Sessions">3</Property>
      <Property label="Oldest report">4 minutes ago</Property>
    </PropertiesPanel>
  );
}

const classes = (element: Element | null | undefined) => element?.className.split(" ") ?? [];

// happy-dom lays nothing out; text reads as cut while these stand.
const prototypes = [HTMLSpanElement.prototype, HTMLButtonElement.prototype];
function cutText(): void {
  for (const proto of prototypes) {
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 100 });
  }
}

describe("PropertiesPanel", () => {
  afterEach(() => {
    for (const proto of prototypes) {
      Reflect.deleteProperty(proto, "scrollWidth");
      Reflect.deleteProperty(proto, "clientWidth");
    }
  });

  it("is a region named Properties that names each value by its label", () => {
    panel();
    const region = screen.getByRole("region", { name: "Properties" });
    expect(region.querySelector("dl")).not.toBeNull();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Sessions",
      "Oldest report",
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "3",
      "4 minutes ago",
    ]);
  });

  it("is a row of chips below 1024 px", () => {
    const { container } = panel();
    expect(classes(container.querySelector("dl"))).toEqual(
      expect.arrayContaining(["max-lg:flex", "max-lg:flex-wrap"])
    );
    const properties = container.querySelectorAll("[data-slot=property]");
    expect(properties).toHaveLength(2);
    for (const property of properties) {
      expect(classes(property)).toEqual(
        expect.arrayContaining(["max-lg:h-control-sm", "max-lg:rounded-badge", "max-lg:border"])
      );
    }
  });

  it("draws each property as one 32 px row with its label at the left", () => {
    const { container } = panel();
    const properties = container.querySelectorAll("[data-slot=property]");
    expect(properties).toHaveLength(2);
    for (const property of properties) {
      expect(classes(property)).toEqual(expect.arrayContaining(["flex", "h-row"]));
      expect(property.firstElementChild?.tagName).toBe("DT");
      expect(classes(property.firstElementChild)).toContain("text-muted-foreground");
    }
  });

  it("stacked, as in a peek, keeps its rows at every width", () => {
    const { container } = panel(true);
    expect(container.querySelectorAll("[data-slot=property]")).toHaveLength(2);
    const drawn = [
      screen.getByRole("region"),
      container.querySelector("dl"),
      ...container.querySelectorAll("[data-slot=property], dt"),
    ].flatMap(classes);
    expect(drawn.filter((name) => /^(max-)?lg:/.test(name))).toEqual([]);
    expect(classes(container.querySelector("[data-slot=property]"))).toContain("h-row");
  });

  it("cuts a text value to its row and shows it in full in a tooltip, a button Tab reaches", () => {
    cutText();
    render(
      <PropertiesPanel>
        <Property label="Note">Two hosts report this name</Property>
      </PropertiesPanel>
    );
    const value = screen.getByRole("definition");
    expect(value.querySelector("[data-slot=truncated-text]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Two hosts report this name" })).toBeDefined();
  });

  it("treats a value of strings and numbers as one text, as `{n} of {m}` or a count", () => {
    cutText();
    const answered = 5;
    const recipients = 8;
    render(
      <PropertiesPanel>
        <Property label="Answered">
          {answered} of {recipients}
        </Property>
        <Property label="Recipients">{recipients}</Property>
      </PropertiesPanel>
    );
    const values = screen.getAllByRole("definition");
    expect(values).toHaveLength(2);
    for (const value of values) {
      expect(value.querySelectorAll("[data-slot=truncated-text]")).toHaveLength(1);
    }
    expect(screen.getByRole("button", { name: "5 of 8" })).toBeDefined();
    expect(screen.getByRole("button", { name: "8" })).toBeDefined();
  });

  it("draws a value that is a part of its own as it is, and clips nothing that holds a focus outline", () => {
    render(
      <PropertiesPanel>
        <Property label="Agents">
          <a href="/agents">Show agents</a>
        </Property>
      </PropertiesPanel>
    );
    const value = screen.getByRole("definition");
    expect(value.querySelector("[data-slot=truncated-text]")).toBeNull();
    expect(value.firstElementChild).toBe(screen.getByRole("link", { name: "Show agents" }));
    for (const element of [value, value.parentElement, screen.getByRole("region")]) {
      expect(classes(element).filter((name) => name.includes("overflow"))).toEqual([]);
    }
  });
});
