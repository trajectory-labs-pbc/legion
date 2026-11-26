import { describe, expect, test } from "bun:test";

import {
  ASK_AT_RISK_DAYS,
  CHANGE_AT_RISK_DAYS,
  CHANGE_OFF_TRACK_DAYS,
  isClosed,
  isInFlight,
  moreThanDays,
  STATE_ORDER,
} from "./progress-model";

const NOW = Date.parse("2026-03-11T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe("progress terms", () => {
  test("only done closes an issue", () => {
    expect(isClosed("done")).toBe(true);
    for (const status of ["todo", "backlog", "in_progress", "testing", "needs_review", "retro"]) {
      expect(isClosed(status)).toBe(false);
    }
  });

  test("four statuses are in flight", () => {
    for (const status of ["in_progress", "testing", "needs_review", "retro"]) {
      expect(isInFlight(status)).toBe(true);
    }
    for (const status of ["todo", "backlog", "done"]) {
      expect(isInFlight(status)).toBe(false);
    }
  });

  test("more than N days is false at exactly N days and true 1 minute later", () => {
    expect(moreThanDays(NOW - 7 * DAY, NOW, 7)).toBe(false);
    expect(moreThanDays(NOW - 7 * DAY - MINUTE, NOW, 7)).toBe(true);
    expect(moreThanDays(NOW - 2 * DAY, NOW, 2)).toBe(false);
    expect(moreThanDays(NOW - 2 * DAY - MINUTE, NOW, 2)).toBe(true);
  });

  test("the limits and the state order", () => {
    expect([ASK_AT_RISK_DAYS, CHANGE_AT_RISK_DAYS, CHANGE_OFF_TRACK_DAYS]).toEqual([2, 7, 14]);
    expect(STATE_ORDER).toEqual([
      "off-track",
      "at-risk",
      "on-track",
      "parked",
      "ready-to-close",
      "closed",
    ]);
  });
});
