// The one place a value part turns a datum into the words it shows.

const UNITS: readonly (readonly [ms: number, suffix: string])[] = [
  [365 * 24 * 60 * 60 * 1000, "y"],
  [30 * 24 * 60 * 60 * 1000, "mo"],
  [7 * 24 * 60 * 60 * 1000, "w"],
  [24 * 60 * 60 * 1000, "d"],
  [60 * 60 * 1000, "h"],
  [60 * 1000, "m"],
];

/** The distance between two instants in its largest whole unit: "now", "5m", "2h", "3d", "4w",
 *  "5mo", "2y". The distance has no direction; the caller's words give it one. */
export function formatAge(at: Date, now: Date): string {
  const distance = Math.abs(now.getTime() - at.getTime());
  for (const [ms, suffix] of UNITS) {
    if (distance >= ms) return `${Math.floor(distance / ms)}${suffix}`;
  }
  return "now";
}

const instantFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** An instant as the reader's locale writes its date and its time. */
export function formatInstant(at: Date): string {
  return instantFormat.format(at);
}
