// The one place a value part turns a datum into the words it shows.

const UNITS: readonly (readonly [ms: number, short: string, word: string])[] = [
  [365 * 24 * 60 * 60 * 1000, "y", "year"],
  [30 * 24 * 60 * 60 * 1000, "mo", "month"],
  [7 * 24 * 60 * 60 * 1000, "w", "week"],
  [24 * 60 * 60 * 1000, "d", "day"],
  [60 * 60 * 1000, "h", "hour"],
  [60 * 1000, "m", "minute"],
];

/** What an invalid instant shows. */
export const NO_INSTANT = "—";

/** Whether a Date holds an instant: `new Date("x")` does not. */
export const isInstant = (at: Date): boolean => !Number.isNaN(at.getTime());

/** The distance between two instants in its largest whole unit, floored, with no direction;
 *  undefined under a minute either way. */
function age(at: Date, now: Date): { count: number; short: string; word: string } | undefined {
  const distance = Math.abs(now.getTime() - at.getTime());
  for (const [ms, short, word] of UNITS) {
    if (distance >= ms) return { count: Math.floor(distance / ms), short, word };
  }
  return undefined;
}

/** The distance between two instants, short: "now", "5m", "2h", "3d", "4w", "5mo", "2y". The
 *  caller's words give it a direction. An invalid instant is a dash. */
export function formatAge(at: Date, now: Date): string {
  if (!isInstant(at) || !isInstant(now)) return NO_INSTANT;
  const found = age(at, now);
  return found === undefined ? "now" : `${found.count}${found.short}`;
}

/** A past instant's age in words, for a reader who hears it: "now", "5 minutes ago". An invalid
 *  instant is a dash. */
export function formatAgeWords(at: Date, now: Date): string {
  if (!isInstant(at) || !isInstant(now)) return NO_INSTANT;
  const found = age(at, now);
  if (found === undefined) return "now";
  return `${found.count} ${found.word}${found.count === 1 ? "" : "s"} ago`;
}

const instantFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** An instant as the reader's locale writes its date and its time. */
export function formatInstant(at: Date): string {
  return instantFormat.format(at);
}
