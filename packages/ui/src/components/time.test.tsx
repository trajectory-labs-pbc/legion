import { describe, expect, it } from "bun:test";
import { render } from "@testing-library/react";

import { formatInstant } from "#registry/legion/lib/format";
import { Time } from "#registry/legion/ui/time";

const AT = new Date("2026-11-26T09:00:00Z");

describe("Time", () => {
  it("shows the instant's age at now in a time element, muted and tabular", () => {
    const { container } = render(<Time now={new Date("2026-11-26T12:00:00Z")} value={AT} />);
    const time = container.querySelector("time");
    expect(time?.textContent).toBe("3h");
    expect(time?.getAttribute("datetime")).toBe("2026-11-26T09:00:00.000Z");
    expect(time?.getAttribute("title")).toBe(formatInstant(AT));
    expect(time?.className).toContain("text-muted-foreground");
    expect(time?.className).toContain("tabular-nums");
  });

  it("is named by its age in words", () => {
    const { container } = render(<Time now={new Date("2026-11-26T09:05:00Z")} value={AT} />);
    expect(container.querySelector("time")?.getAttribute("aria-label")).toBe("5 minutes ago");
  });

  it("shows a dash with no time element, datetime or title for an invalid instant", () => {
    const { container } = render(<Time now={AT} value={new Date("not a date")} />);
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).toBe("—");
    expect(container.querySelector("[datetime], [title]")).toBeNull();
  });

  it("changes only when its caller renders it again with a later now", () => {
    const { container, rerender } = render(
      <Time now={new Date("2026-11-26T09:05:00Z")} value={AT} />
    );
    expect(container.textContent).toBe("5m");
    rerender(<Time now={new Date("2026-11-27T09:05:00Z")} value={AT} />);
    expect(container.textContent).toBe("1d");
  });
});
