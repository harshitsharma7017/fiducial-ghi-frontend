import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COVER_OFFERS,
  GPA_COVERS,
  emptyGpaRequirements,
  emptyGtliRequirements,
  gpaDeviations,
  gtliDeviations,
  lowestMarks,
  qcrCandidates,
  type GpaQuoteTerms,
} from '@/shared';
import { RUNS, arbDigits } from './eb-arbitraries.test-utils';

describe('quote and QCR properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 28: GPA and GTLI deviations
  it('finds GPA and GTLI deviations exactly as the Data Sheet asks', () => {
    const arbChoice = fc.constantFrom('REQUIRED' as const, 'NOT_REQUIRED' as const, null);
    const arbTerm = fc.record({
      offer: fc.constantFrom(...COVER_OFFERS),
      limitAmount: fc.option(arbDigits(1, 7), { nil: null }),
      limitText: fc.option(fc.constant('as per the table'), { nil: null }),
    });
    fc.assert(
      fc.property(
        fc.tuple(arbChoice, arbChoice, arbChoice, arbChoice),
        fc.tuple(arbTerm, arbTerm, arbTerm, arbTerm),
        (choices, terms) => {
          const sheet = {
            ...emptyGpaRequirements(),
            covers: Object.fromEntries(
              GPA_COVERS.map((cover, index) => [cover, choices[index]]),
            ) as never,
          };
          const quote: GpaQuoteTerms = {
            covers: Object.fromEntries(
              GPA_COVERS.map((cover, index) => [cover, terms[index]]),
            ) as GpaQuoteTerms['covers'],
          };
          const found = gpaDeviations(sheet, quote).map((item) => `${item.field}:${item.kind}`);
          const expected = GPA_COVERS.flatMap((cover, index) => {
            if (choices[index] !== 'REQUIRED') return [];
            if (terms[index]!.offer === 'NOT_OFFERED') return [`covers.${cover}:DEVIATION`];
            if (terms[index]!.offer === 'NOT_STATED') return [`covers.${cover}:MISSING`];
            return [];
          });
          expect(found).toEqual(expected);
        },
      ),
      RUNS,
    );
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 1, max: 5_000_000 }), { nil: null }),
        fc.option(fc.integer({ min: 1, max: 5_000_000 }), { nil: null }),
        (asked, offered) => {
          const found = gtliDeviations(
            { ...emptyGtliRequirements(), freeCoverLimit: asked === null ? null : String(asked) },
            { freeCoverLimit: offered === null ? null : String(offered), additionalBenefits: null },
          ).map((item) => item.kind);
          const expected =
            asked === null
              ? []
              : offered === null
                ? ['MISSING']
                : offered < asked
                  ? ['DEVIATION']
                  : [];
          expect(found).toEqual(expected);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 29: The QCR compares each insurer's latest recorded quote and marks every lowest
  it('takes each insurer’s highest recorded version and marks every lowest total', () => {
    const arbQuote = fc.record({
      insurerId: fc.constantFrom('i1', 'i2', 'i3', 'i4'),
      version: fc.integer({ min: 1, max: 6 }),
      status: fc.constantFrom('DRAFT' as const, 'FINAL' as const),
      totalPremium: fc.constantFrom('1000.00', '1000.5', '999.99', '1200.00'),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(arbQuote, {
          selector: (quote) => `${quote.insurerId}|${quote.version}`,
          maxLength: 12,
        }),
        fc.uniqueArray(fc.constantFrom('i1', 'i2', 'i3', 'i4'), { maxLength: 4 }),
        (raw, declinedList) => {
          const quotes = raw.map((quote, index) => ({ ...quote, id: `q${index}` }));
          const declined = new Set<string>(declinedList);
          const chosen = qcrCandidates(quotes, declined);
          const expected = ['i1', 'i2', 'i3', 'i4'].flatMap((insurer) => {
            if (declined.has(insurer)) return [];
            const recorded = quotes.filter(
              (quote) => quote.insurerId === insurer && quote.status === 'FINAL',
            );
            if (recorded.length === 0) return [];
            return [
              recorded.reduce((best, quote) => (quote.version > best.version ? quote : best)),
            ];
          });
          const byInsurer = (list: typeof quotes) =>
            [...list].sort((a, b) => a.insurerId.localeCompare(b.insurerId));
          expect(byInsurer(chosen)).toEqual(byInsurer(expected));
          for (const quote of chosen) expect(quote.status).toBe('FINAL');
        },
      ),
      RUNS,
    );
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        (paise, padded) => {
          // The same amount written with one or two decimals compares equal to the paisa.
          const totals = paise.map((value, index) => {
            const text = `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
            return padded[index] && text.endsWith('0') ? text.slice(0, -1) : text;
          });
          const lowest = Math.min(...paise);
          expect([...lowestMarks(totals)].sort()).toEqual(
            paise.flatMap((value, index) => (value === lowest ? [index] : [])).sort(),
          );
        },
      ),
      RUNS,
    );
  });
});
