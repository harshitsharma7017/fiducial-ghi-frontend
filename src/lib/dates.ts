/**
 * Date helpers that work in India Standard Time (UTC+05:30) whatever the machine's time zone, on
 * `YYYY-MM-DD` strings. Display uses the shared formatDate (DD MMM YYYY).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type IsoDate = string;

/** The IST calendar date of an instant, as YYYY-MM-DD. */
export function toIstDate(instant: Date | number): IsoDate {
  const ms = typeof instant === 'number' ? instant : instant.getTime();
  // Shift by the IST offset, then read the UTC calendar fields of the shifted instant.
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's date in IST. */
export function todayIst(now: Date | number = Date.now()): IsoDate {
  return toIstDate(now);
}

/** Midnight IST of a YYYY-MM-DD date, in epoch ms (used only for day arithmetic). */
function istMidnightMs(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00.000Z`) - IST_OFFSET_MS;
}

/** The date `days` after `date` (negative for earlier), as YYYY-MM-DD. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return toIstDate(istMidnightMs(date) + days * DAY_MS + IST_OFFSET_MS);
}

/** Whole calendar days from `from` to `to` in IST; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((istMidnightMs(to) - istMidnightMs(from)) / DAY_MS);
}

/** True when both dates fall in the same IST calendar month. */
export function isSameIstMonth(a: IsoDate, b: IsoDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The last day of a one-year policy starting on a date: a year on, less a day (29 Feb safe). */
export function policyYearEnd(start: IsoDate): IsoDate {
  const date = new Date(`${start}T00:00:00Z`);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  // 29 Feb plus a year rolls into March; step back to the end of February.
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  else date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
