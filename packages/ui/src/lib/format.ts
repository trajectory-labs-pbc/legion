// The one place a value part turns a datum into the words it shows.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS: readonly (readonly [ms: number, short: string, word: string])[] = [
  [365 * DAY, "y", "year"],
  [30 * DAY, "mo", "month"],
  [7 * DAY, "w", "week"],
  [DAY, "d", "day"],
  [HOUR, "h", "hour"],
  [MINUTE, "m", "minute"],
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

/** An instant as the reader's locale writes its date and its time; an invalid one is a dash. */
export function formatInstant(at: Date): string {
  return isInstant(at) ? instantFormat.format(at) : NO_INSTANT;
}
