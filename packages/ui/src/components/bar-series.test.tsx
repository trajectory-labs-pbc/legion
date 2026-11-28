import { describe, expect, it, jest } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { type BarPoint, BarSeries } from "#registry/legion/ui/bar-series";

const points: BarPoint[] = [
  { kind: "met", label: "Sep 26: 90% success", value: 0.9 },
  { kind: "missed", label: "Sep 27: 40% success", value: 0.4 },
  { kind: "empty", label: "Sep 28: no runs" },
  { kind: "neutral", label: "Sep 29 (partial day): 70% success", partial: true, value: 0.7 },
];

const columns = (series: Element) => [...series.querySelectorAll("[data-slot=bar-series-point]")];
// Each column's drawn bars, after the transparent rect that takes the pointer.
const bars = (column: Element | undefined) =>
  [...(column?.querySelectorAll("rect") ?? [])].slice(1);
const described = () => {
  const id = screen.getByRole("img").getAttribute("aria-describedby");
  return id === null ? null : document.getElementById(id);
};
const itemTexts = (list: Element | null) =>
  [...(list?.querySelectorAll("li") ?? [])].map((item) => item.textContent);
// The pointer rests on a column past the tooltip's half-second delay, on fake timers.
const hover = (column: Element) => {
  fireEvent.pointerEnter(column, { pointerType: "mouse" });
  fireEvent.mouseEnter(column);
  fireEvent.mouseMove(column);
  act(() => jest.advanceTimersByTime(550));
};
const only = (props: { floor: number; points: BarPoint[] }) => {
  render(<BarSeries label="Bars" {...props} />);
  return bars(columns(screen.getByRole("img"))[0]);
};

describe("BarSeries", () => {
  it("is one image named by its label, one column a point", () => {
    render(<BarSeries floor={1} label="Per-day success" points={points} />);
    const series = screen.getByRole("img", { name: "Per-day success" });
    expect(columns(series).map((column) => column.getAttribute("data-kind"))).toEqual([
      "met",
      "missed",
      "empty",
      "neutral",
    ]);
    expect(series.getAttribute("viewBox")).toBe("0 0 40 28");
  });

  it("is described by a hidden list of its points' labels, a judged one with its verdict in words", () => {
    render(<BarSeries floor={1} label="Per-day success" points={points} />);
    const list = described();
    expect(list?.tagName).toBe("UL");
    expect(list?.className).toBe("sr-only");
    expect(itemTexts(list)).toEqual([
      "Sep 26: 90% success (met)",
      "Sep 27: 40% success (missed)",
      "Sep 28: no runs",
      "Sep 29 (partial day): 70% success",
    ]);
  });

  it("names the faint value's verdict beside the bar's", () => {
    render(
      <BarSeries
        floor={1}
        label="Median and p90"
        points={[
          { behind: { kind: "missed", value: 2 }, kind: "met", label: "a", value: 1 },
          { behind: { kind: "met", value: 2 }, kind: "neutral", label: "b", value: 1 },
          { behind: { kind: "neutral", value: 2 }, kind: "missed", label: "c", value: 1 },
        ]}
      />
    );
    expect(itemTexts(described())).toEqual([
      "a (bar met, faint bar missed)",
      "b (bar not judged, faint bar met)",
      "c (missed)",
    ]);
  });

  it("draws met and missed in the passed and failed colours, and neutral in a quieter grey", () => {
    render(<BarSeries floor={1} label="Bars" points={points} target={0.8} />);
    const fills = columns(screen.getByRole("img")).map((column) =>
      bars(column).map((bar) => bar.getAttribute("class")?.split(" ")[0])
    );
    expect(fills).toEqual([
      ["fill-success"],
      ["fill-danger"],
      ["fill-muted-foreground"],
      ["fill-faint-foreground"],
    ]);
  });

  it("draws an empty point as a one-unit stub on the floor", () => {
    const [stub] = only({ floor: 1, points: [{ kind: "empty", label: "no runs" }] });
    expect(stub?.getAttribute("height")).toBe("1");
    expect(stub?.getAttribute("y")).toBe("27");
  });

  it.each([
    0, 0.001,
  ])("draws a value of %p as a one-unit bar inside the chart, in its kind", (value) => {
    const [bar] = only({ floor: 3, points: [{ kind: "missed", label: "deploys", value }] });
    expect(bar?.getAttribute("class")).toBe("fill-danger");
    expect(bar?.getAttribute("y")).toBe("27");
    expect(bar?.getAttribute("height")).toBe("1");
  });

  it("draws every bar on the floor when the scale's top is 0", () => {
    const [bar] = only({ floor: 0, points: [{ kind: "neutral", label: "none", value: 0 }] });
    expect(bar?.getAttribute("y")).toBe("27");
    expect(bar?.getAttribute("height")).toBe("1");
  });

  it("scales a bar against its floor, and grows past it to the tallest value", () => {
    const { rerender } = render(
      <BarSeries floor={1} label="Bars" points={[{ kind: "neutral", label: "half", value: 0.5 }]} />
    );
    const height = () => bars(columns(screen.getByRole("img"))[0])[0]?.getAttribute("height");
    expect(height()).toBe("14");
    rerender(
      <BarSeries
        floor={1}
        label="Bars"
        points={[
          { kind: "neutral", label: "half", value: 0.5 },
          { kind: "neutral", label: "two", value: 2 },
        ]}
      />
    );
    expect(height()).toBe("7");
  });

  it("draws the target as one dashed line a quarter under the scale's top at most", () => {
    const { container, rerender } = render(<BarSeries floor={1} label="Bars" points={points} />);
    expect(container.querySelector("line")).toBeNull();
    rerender(<BarSeries floor={0} label="Bars" points={points} target={1} />);
    const line = container.querySelector("[data-slot=bar-series-target]");
    expect(line?.getAttribute("stroke-dasharray")).toBe("3 2");
    expect(line?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    // The top is 1.25: the line at 1 sits a fifth of the height under it.
    expect(Number(line?.getAttribute("y1"))).toBeCloseTo(28 / 5);
  });

  it("draws the second value faint behind the bar, each judged in its own kind", () => {
    render(
      <BarSeries
        floor={1}
        label="Median and p90"
        points={[
          {
            behind: { kind: "missed", value: 20 },
            kind: "met",
            label: "median 10m, p90 20m",
            value: 10,
          },
        ]}
        size="lg"
      />
    );
    const [faint, bar] = bars(columns(screen.getByRole("img"))[0]);
    expect(faint?.getAttribute("class")).toBe("fill-danger-faint");
    expect(faint?.getAttribute("height")).toBe("36");
    expect(bar?.getAttribute("class")).toBe("fill-success");
    expect(bar?.getAttribute("height")).toBe("18");
  });

  it("draws a neutral faint value apart from an empty stub", () => {
    render(
      <BarSeries
        floor={1}
        label="Median and p90"
        points={[
          { behind: { kind: "neutral", value: 1 }, kind: "neutral", label: "a", value: 0.5 },
          { kind: "empty", label: "b" },
        ]}
      />
    );
    const [withFaint, empty] = columns(screen.getByRole("img"));
    const faint = bars(withFaint)[0]?.getAttribute("class");
    expect(faint).toBe("fill-track");
    expect(bars(empty)[0]?.getAttribute("class")).not.toBe(faint);
  });

  it.each([
    ["default", "h-7", "0 0 10 28", "8", "opacity-40"],
    ["lg", "h-9", "0 0 12 36", "10", "opacity-55"],
  ] as const)("at size %p is %p high in a %p box, with bars %p wide and a partial point at %p", (size, heightClass, viewBox, barWidth, fade) => {
    render(
      <BarSeries
        floor={1}
        label="Bars"
        points={[{ kind: "neutral", label: "today", partial: true, value: 1 }]}
        size={size}
      />
    );
    const series = screen.getByRole("img");
    expect(series.getAttribute("class")).toContain(heightClass);
    expect(series.getAttribute("viewBox")).toBe(viewBox);
    const [bar] = bars(columns(series)[0]);
    expect(bar?.getAttribute("width")).toBe(barWidth);
    expect(bar?.getAttribute("class")).toBe(`fill-faint-foreground ${fade}`);
  });

  it("fades a partial point's bar and its empty stub, never its faint value, nor a whole point", () => {
    render(
      <BarSeries
        floor={1}
        label="Bars"
        points={[
          { behind: { kind: "met", value: 1 }, kind: "met", label: "a", partial: true, value: 0.5 },
          { kind: "empty", label: "b", partial: true },
          { kind: "met", label: "c", value: 0.5 },
        ]}
      />
    );
    const [partial, stub, whole] = columns(screen.getByRole("img")).map((column) =>
      bars(column).map((bar) => bar.getAttribute("class"))
    );
    expect(partial).toEqual(["fill-success-faint", "fill-success opacity-40"]);
    expect(stub).toEqual(["fill-muted-foreground opacity-40"]);
    expect(whole).toEqual(["fill-success"]);
  });

  it("shows a point's text and verdict in a tooltip when the pointer rests on its column", () => {
    jest.useFakeTimers();
    try {
      render(<BarSeries floor={1} label="Bars" points={points} />);
      const column = columns(screen.getByRole("img"))[0];
      if (column === undefined) throw new Error("no first column");
      hover(column);
      // Once in the hidden list, once in the tooltip.
      expect(screen.getAllByText("Sep 26: 90% success (met)")).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a column and its open tooltip when a live update changes the point's label", () => {
    jest.useFakeTimers();
    try {
      const today = (label: string): BarPoint[] => [{ kind: "neutral", label, value: 0.5 }];
      const { rerender } = render(<BarSeries floor={1} label="Bars" points={today("9 runs")} />);
      const column = columns(screen.getByRole("img"))[0];
      if (column === undefined) throw new Error("no column");
      hover(column);
      rerender(<BarSeries floor={1} label="Bars" points={today("10 runs")} />);
      expect(columns(screen.getByRole("img"))[0]).toBe(column);
      expect(screen.getAllByText("10 runs")).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
