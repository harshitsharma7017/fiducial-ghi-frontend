import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ebPremium,
  paymentsSummary,
  percentOfSumInsured,
  salaryMultipleSumInsured,
  type GhiPaymentStatus,
} from '@/shared';
import { RUNS, arbDigits, arbUpToHundred } from './eb-arbitraries.test-utils';

// Oracles in rational arithmetic: a decimal string is numerator / 10^scale (BigInt).
const rational = (text: string) => {
  const [whole = '0', fraction = ''] = text.split('.');
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
};
const halfUp = (n: bigint, d: bigint) => {
  const q = n / d;
  return (n % d) * 2n >= d ? q + 1n : q;
};
const twoDecimals = (paise: bigint) => `${paise / 100n}.${String(paise % 100n).padStart(2, '0')}`;
const paiseOf = (text: string) => {
  const value = rational(text);
  return halfUp(value.n * 100n, value.d);
};

describe('money properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 3: Sums insured from salary and percentage round half up and respect the cap
  it('works out sums insured from salary and percentage, half up and capped', () => {
    fc.assert(
      fc.property(
        arbDigits(1, 13),
        arbUpToHundred,
        fc.option(arbDigits(1, 13), { nil: null }),
        arbDigits(1, 6),
        (salary, multiplier, maximum, raise) => {
          const s = rational(salary);
          const m = rational(multiplier);
          const exact = halfUp(s.n * m.n, s.d * m.d);
          const expected = maximum !== null && BigInt(maximum) < exact ? BigInt(maximum) : exact;
          const result = salaryMultipleSumInsured(salary, multiplier, maximum);
          expect(result).toBe(expected.toString());
          if (maximum !== null) expect(BigInt(result) <= BigInt(maximum)).toBe(true);
          const higher = (BigInt(salary) + BigInt(raise)).toString();
          expect(
            BigInt(salaryMultipleSumInsured(higher, multiplier, maximum)) >= BigInt(result),
          ).toBe(true);
        },
      ),
      RUNS,
    );
    fc.assert(
      fc.property(arbDigits(1, 13), arbUpToHundred, (sumInsured, percent) => {
        const p = rational(percent);
        const expected = halfUp(BigInt(sumInsured) * p.n, p.d * 100n);
        expect(percentOfSumInsured(sumInsured, percent)).toBe(expected.toString());
      }),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 4: Quote GST and total
  it('works out GST half up to the paisa and the total as base plus GST', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 99_999_999_999n }),
        fc.integer({ min: 0, max: 10_000 }),
        (basePaise, rateHundredths) => {
          const base = twoDecimals(basePaise);
          const rate = `${Math.floor(rateHundredths / 100)}.${String(rateHundredths % 100).padStart(2, '0')}`;
          const gst = halfUp(basePaise * BigInt(rateHundredths), 10_000n);
          const result = ebPremium(base, rate);
          expect(result).toEqual({
            basePremium: base,
            gst: twoDecimals(gst),
            totalPremium: twoDecimals(basePaise + gst),
          });
          for (const value of Object.values(result)) expect(value).toMatch(/^\d+\.\d{2}$/);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 30: The payments summary counts only received payments
  it('sums received and pending payments, never counting failed or bounced ones', () => {
    const arbAmount = fc.bigInt({ min: 1n, max: 9_999_999_999n }).map(twoDecimals);
    const arbPayment = fc.record({
      amount: arbAmount,
      status: fc.constantFrom<GhiPaymentStatus>('RECEIVED', 'PENDING', 'FAILED'),
    });
    fc.assert(
      fc.property(
        fc.option(arbAmount, { nil: null }),
        fc.array(arbPayment, { maxLength: 12 }),
        fc.array(arbAmount, { maxLength: 4 }),
        (agreed, payments, failedExtra) => {
          const sum = (status: GhiPaymentStatus) =>
            payments
              .filter((payment) => payment.status === status)
              .reduce((total, payment) => total + paiseOf(payment.amount), 0n);
          const received = sum('RECEIVED');
          const summary = paymentsSummary(agreed, payments);
          expect(summary.received).toBe(twoDecimals(received));
          expect(summary.pending).toBe(twoDecimals(sum('PENDING')));
          if (agreed === null) {
            expect(summary.outstanding).toBeNull();
            expect(summary.covered).toBe(false);
          } else {
            const left = paiseOf(agreed) - received;
            expect(summary.outstanding).toBe(twoDecimals(left > 0n ? left : 0n));
            expect(summary.covered).toBe(received >= paiseOf(agreed));
          }
          const withFailed = [
            ...payments,
            ...failedExtra.map((amount) => ({ amount, status: 'FAILED' as const })),
          ];
          expect(paymentsSummary(agreed, withFailed)).toEqual(summary);
        },
      ),
      RUNS,
    );
  });
});
