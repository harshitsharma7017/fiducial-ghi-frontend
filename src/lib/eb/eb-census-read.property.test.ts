import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  emptyRowValues,
  parseCensusDate,
  readEbCensusRow,
  type EbCensusField,
  type EbCensusRowValues,
} from '@/shared';
import { RUNS, TODAY, arbDate, isoOf } from './eb-arbitraries.test-utils';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_MS = 86_400_000;
const serialOf = (iso: string) =>
  (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / DAY_MS;

describe('census reading properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 1: Day-first census dates read back exactly
  it('reads every accepted date form back to the same date, day first', () => {
    fc.assert(
      fc.property(
        arbDate(1900, 2200),
        fc.boolean(),
        fc.nat(),
        ({ year, month, day, iso }, zeros, form) => {
          const d = zeros ? String(day).padStart(2, '0') : String(day);
          const m = zeros ? String(month).padStart(2, '0') : String(month);
          const name = MONTHS[month - 1]!;
          const forms = [
            `${d}/${m}/${year}`,
            `${d}-${m}-${year}`,
            `${d}.${m}.${year}`,
            `${year}-${m}-${d}`,
            `${d}-${name.slice(0, 3)}-${year}`,
            `${d} ${name} ${year}`,
          ];
          const serial = serialOf(iso);
          // The reader takes 4- or 5-digit serials (to 13 Oct 2173); its 109,573 bound is unreachable.
          if (serial >= 1000 && serial <= 99_999) forms.push(String(serial));
          const text = forms[form % forms.length]!;
          expect(parseCensusDate(text)).toEqual({ ok: true, date: iso });
        },
      ),
      RUNS,
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1900, max: 2200 }),
        (day, month, year) => {
          fc.pre(day !== month);
          const text = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
          expect(parseCensusDate(text)).toEqual({ ok: true, date: isoOf(year, month, day) });
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 2: Invalid census values are refused on their own field
  it('refuses one invalid field on that field only, and leaves the member unread', () => {
    const base: EbCensusRowValues = {
      ...emptyRowValues(),
      employeeId: 'E1023',
      name: 'Ravi Nair',
      gender: 'Male',
      dateOfBirth: '01/02/1985',
      relationship: 'Self',
      dateOfJoining: '01/04/2015',
      sumInsured: '500000',
      annualSalary: '600000',
    };
    const invalid: Array<[EbCensusField, fc.Arbitrary<string>]> = [
      [
        'dateOfBirth',
        fc.constantFrom('03/04/85', '31/02/1990', '12/25/1990', '01/01/2027', '17/10/2026'),
      ],
      [
        'dateOfJoining',
        fc.constantFrom('03/04/15', '30/02/2015', '06/13/2015', '17/10/2026', '01/01/2030'),
      ],
      ['gender', fc.constantFrom('Unknown', 'X', 'Mail')],
      ['relationship', fc.constantFrom('Cousin', 'Uncle', 'Friend')],
      [
        'employeeId',
        fc.oneof(
          fc.constant(''),
          fc.constant('E 12'),
          fc.constant('E#12'),
          fc
            .string({ minLength: 41, maxLength: 60 })
            .map((text) => `E${text.replace(/[^A-Za-z0-9]/g, 'x')}`),
        ),
      ],
      ['name', fc.oneof(fc.constant(''), fc.constant('   '), fc.constant('a'.repeat(121)))],
      ['sumInsured', fc.constantFrom('0', '12.5', 'abc', '-5', '5e5')],
      ['annualSalary', fc.constantFrom('0', '12.5', 'abc', '-5', '1,2,3.4')],
    ];
    fc.assert(
      fc.property(
        fc
          .integer({ min: 0, max: invalid.length - 1 })
          .chain((index) =>
            invalid[index]![1].map((value) => [invalid[index]![0], value] as const),
          ),
        ([field, value]) => {
          const read = readEbCensusRow(
            { ...base, [field]: value },
            { row: 7, today: TODAY, assumeSelf: false },
          );
          expect(read.member).toBeNull();
          expect(read.issues.length).toBeGreaterThan(0);
          for (const issue of read.issues) {
            expect(issue.field).toBe(field);
            expect(issue.row).toBe(7);
            expect(issue.message.length).toBeGreaterThan(0);
            expect(issue.fix?.length ?? 0).toBeGreaterThan(0);
          }
        },
      ),
      RUNS,
    );
    expect(readEbCensusRow(base, { row: 7, today: TODAY, assumeSelf: false }).issues).toEqual([]);
  });
});
