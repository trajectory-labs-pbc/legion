import { describe, expect, it } from "bun:test";

import { formatAge, formatAgeWords, formatInstant, NO_INSTANT } from "#registry/legion/lib/format";

const NOW = new Date("2026-11-26T12:00:00Z");
const before = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatAge", () => {
  it.each([
    [0, "now"],
    [59_999, "now"],
    [MINUTE, "1m"],
    [59 * MINUTE, "59m"],
    [HOUR, "1h"],
    [23 * HOUR + 59 * MINUTE, "23h"],
    [DAY, "1d"],
    [6 * DAY, "6d"],
    [7 * DAY, "1w"],
    [29 * DAY, "4w"],
    [30 * DAY, "1mo"],
    [364 * DAY, "12mo"],
    [365 * DAY, "1y"],
    [800 * DAY, "2y"],
  ])("writes %p ms as %p, in its largest whole unit", (ms, words) => {
    expect(formatAge(before(ms), NOW)).toBe(words);
  });

  it("gives an instant after now the same words as one before it", () => {
    expect(formatAge(new Date(NOW.getTime() + 2 * HOUR), NOW)).toBe("2h");
    expect(formatAge(new Date(NOW.getTime() + 59_999), NOW)).toBe("now");
  });

  it("writes an invalid instant, or an invalid now, as a dash and never as now", () => {
    expect(formatAge(new Date("not a date"), NOW)).toBe(NO_INSTANT);
    expect(formatAge(NOW, new Date(Number.NaN))).toBe(NO_INSTANT);
    expect(NO_INSTANT).not.toBe("now");
  });
});

describe("formatAgeWords", () => {
  it.each([
    [0, "now"],
    [59_999, "now"],
    [MINUTE, "1 minute ago"],
    [5 * MINUTE, "5 minutes ago"],
    [HOUR, "1 hour ago"],
    [3 * DAY, "3 days ago"],
    [7 * DAY, "1 week ago"],
    [60 * DAY, "2 months ago"],
    [800 * DAY, "2 years ago"],
  ])("names %p ms as %p", (ms, words) => {
    expect(formatAgeWords(before(ms), NOW)).toBe(words);
  });

  it("names an invalid instant as a dash", () => {
    expect(formatAgeWords(new Date("not a date"), NOW)).toBe(NO_INSTANT);
  });
});

describe("formatInstant", () => {
  it("writes the date and the time in the reader's locale", () => {
    const words = formatInstant(NOW);
    expect(words).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(NOW)
    );
    expect(words).toContain("2026");
  });
});
