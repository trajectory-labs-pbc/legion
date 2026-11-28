import { describe, expect, it } from "bun:test";
import { render, screen, within } from "@testing-library/react";

import { MetricCard, MetricFigure, MetricGrid } from "#registry/legion/blocks/metric-grid";

describe("MetricGrid", () => {
  it("sets its columns from its own width: one, then two, three and six at a 13.25rem card", () => {
    const { container } = render(
      <MetricGrid>
        <div />
      </MetricGrid>
    );
    const grid = container.querySelector("[data-slot=metric-grid]");
    expect(grid?.className).toContain("@container");
    expect(grid?.firstElementChild?.className.split(" ")).toEqual([
      "grid",
      "grid-cols-1",
      "gap-3",
      "@min-[27.25rem]:grid-cols-2",
      "@min-[41.25rem]:grid-cols-3",
      "@min-[83.25rem]:grid-cols-6",
    ]);
  });

  it("is a group named by its label, and no group without one", () => {
    const { rerender } = render(
      <MetricGrid label="KPI targets">
        <div />
      </MetricGrid>
    );
    expect(screen.getByRole("group", { name: "KPI targets" })).toBeTruthy();
    rerender(
      <MetricGrid>
        <div />
      </MetricGrid>
    );
    expect(screen.queryByRole("group")).toBeNull();
  });
});

describe("MetricCard", () => {
  it("is a bordered region named by its title, with its detail, its mark and its content", () => {
    render(
      <MetricCard
        data-metric="pr-ci"
        detail="From the first job's start to the last job's end"
        end={<span>target met</span>}
        title="PR CI"
      >
        <p>Figures</p>
      </MetricCard>
    );
    const card = screen.getByRole("region", { name: "PR CI" });
    expect(card.tagName).toBe("SECTION");
    expect(card.getAttribute("data-metric")).toBe("pr-ci");
    for (const part of ["rounded-lg", "border", "border-border", "bg-card", "p-3"])
      expect(card.className.split(" ")).toContain(part);
    expect(within(card).getByRole("heading", { level: 2 }).textContent).toBe("PR CI");
    const detail = within(card).getByText("From the first job's start to the last job's end");
    expect(detail.getAttribute("data-slot")).toBe("truncated-text");
    expect(detail.closest("p")?.className).toContain("text-muted-foreground");
    expect(within(card).getByText("target met").parentElement?.className).toContain("shrink-0");
    expect(within(card).getByText("Figures")).toBeTruthy();
  });

  it("draws neither a detail nor a mark, nor their wrappers, when it has none", () => {
    const { container } = render(<MetricCard end={false} title="Deploys" />);
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("[data-slot=metric-card] > div")?.children).toHaveLength(1);
  });
});

describe("MetricFigure", () => {
  it("is a term and its value: the label, the figure with its unit, then the second line", () => {
    const { container } = render(
      <MetricFigure label="Today" secondary="p90 14m · 12 runs" unit="median" value="9m" />
    );
    const list = container.querySelector("dl");
    expect(list?.querySelector("dt")?.textContent).toBe("Today");
    const values = [...(list?.querySelectorAll("dd") ?? [])];
    expect(values.map((value) => value.textContent)).toEqual(["9mmedian", "p90 14m · 12 runs"]);
    expect(screen.getByText("9m").className.split(" ").sort()).toEqual([
      "font-semibold",
      "tabular-nums",
      "text-base",
      "wrap-pretty",
    ]);
    expect(screen.getByText("median").className).toContain("text-muted-foreground");
  });

  it("draws a value of 0 and a second line of 0 as their 0", () => {
    const { container } = render(<MetricFigure label="Failures" secondary={0} value={0} />);
    const values = [...container.querySelectorAll("dd")].map((value) => value.textContent);
    expect(values).toEqual(["0", "0"]);
  });

  it("draws no term list without a label, and no unit or second line without them", () => {
    const { container } = render(<MetricFigure value="2.4/day" />);
    expect(container.querySelector("dl, dt, dd")).toBeNull();
    const figure = container.querySelector("[data-slot=metric-figure]");
    expect(figure?.textContent).toBe("2.4/day");
    expect(figure?.children).toHaveLength(1);
  });
});
