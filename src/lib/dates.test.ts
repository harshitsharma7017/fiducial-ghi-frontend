import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isSameIstMonth, todayIst, policyYearEnd } from './dates';

describe('IST date helpers', () => {
  it('reads the IST calendar date around midnight', () => {
    // 18:29 UTC is still 2026-03-31 in IST; 18:30 UTC is 2026-04-01.
    expect(todayIst(Date.parse('2026-03-31T18:29:59.000Z'))).toBe('2026-03-31');
    expect(todayIst(Date.parse('2026-03-31T18:30:00.000Z'))).toBe('2026-04-01');
  });

  it('adds and subtracts days across month and year ends', () => {
    expect(addDays('2026-10-05', 30)).toBe('2026-11-04');
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('counts whole days and compares months', () => {
    expect(daysBetween('2026-10-05', '2026-11-04')).toBe(30);
    expect(daysBetween('2026-11-04', '2026-10-05')).toBe(-30);
    expect(isSameIstMonth('2026-10-01', '2026-10-31')).toBe(true);
    expect(isSameIstMonth('2026-10-31', '2026-11-01')).toBe(false);
  });

  // Feature: frontend-shell, Property 4: Dates follow the IST calendar
  it('round-trips addDays through daysBetween, in any machine time zone', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2032-12-31T23:59:59Z'),
          noInvalidDate: true,
        }),
        fc.integer({ min: -4000, max: 4000 }),
        (instant, n) => {
          const start = todayIst(instant);
          expect(daysBetween(start, addDays(start, n))).toBe(n);
        },
      ),
    );
  });

  // Feature: frontend-shell, Property 4: Dates follow the IST calendar
  it('agrees month comparison with the year-and-month prefix', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2032-12-31T23:59:59Z'),
          noInvalidDate: true,
        }),
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2032-12-31T23:59:59Z'),
          noInvalidDate: true,
        }),
        (a, b) => {
          const [da, db] = [todayIst(a), todayIst(b)];
          expect(isSameIstMonth(da, db)).toBe(da.slice(0, 7) === db.slice(0, 7));
        },
      ),
    );
  });
});

describe('policyYearEnd', () => {
  it('ends a year on, less a day', () => {
    expect(policyYearEnd('2026-11-01')).toBe('2027-10-31');
    expect(policyYearEnd('2027-01-01')).toBe('2027-12-31');
    expect(policyYearEnd('2028-02-29')).toBe('2029-02-28');
    expect(policyYearEnd('2027-03-01')).toBe('2028-02-29');
  });
});
