import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelativeTime', () => {
  it.each([
    [10_000, 'just now'],
    [50_000, '1 minute ago'],
    [25 * 60_000, '25 minutes ago'],
    [130 * 60_000, '2 hours ago'],
    [27 * 3600_000, 'yesterday'],
    [3 * 86_400_000, '3 days ago'],
    [9 * 86_400_000, 'last week'],
  ])('%i ms ago reads "%s"', (ms, expected) => {
    expect(formatRelativeTime(ago(ms), NOW)).toBe(expected);
  });
});
