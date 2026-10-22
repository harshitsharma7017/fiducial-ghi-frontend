const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const formatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

/** "just now", "25 minutes ago", "yesterday", "3 days ago": `at` relative to `nowMs`. */
export function formatRelativeTime(at: string, nowMs: number): string {
  const seconds = Math.round((Date.parse(at) - nowMs) / 1000);
  const size = Math.abs(seconds);
  if (size < 45) return 'just now';
  for (const [unit, unitSeconds] of UNITS) {
    if (size >= unitSeconds) return formatter.format(Math.round(seconds / unitSeconds), unit);
  }
  return formatter.format(Math.round(seconds / 60), 'minute');
}
