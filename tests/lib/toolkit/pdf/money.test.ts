import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTotals,
  minorDigits,
  parseDecimal,
  sumAmounts,
  sumNumbers,
} from '../../../../src/lib/toolkit/pdf/money';

const base = {
  currency: 'USD',
  discountType: 'percent' as const,
  discountValue: '0',
  taxRate: '0',
};

test('exact decimal math: 0.1 + 0.2 is 0.30, not 0.30000000000000004', () => {
  const t = computeTotals(
    [
      { quantity: '1', unitPrice: '0.1' },
      { quantity: '1', unitPrice: '0.2' },
    ],
    base,
  );
  assert.equal(t.subtotal, '0.30');
});

test('line amounts round half up to the currency minor unit', () => {
  const t = computeTotals([{ quantity: '3', unitPrice: '0.335' }], base);
  assert.deepEqual(t.lines, ['1.01']); // 1.005 -> 1.01 (floats would give 1.00)
});

test('fractional quantities (hours)', () => {
  const t = computeTotals([{ quantity: '1.5', unitPrice: '80' }], base);
  assert.equal(t.total, '120.00');
});

test('percent tax with a 3-decimal rate', () => {
  const t = computeTotals([{ quantity: '1', unitPrice: '100' }], { ...base, taxRate: '8.875' });
  assert.equal(t.tax, '8.88'); // 8.875 rounds half up
  assert.equal(t.total, '108.88');
});

test('tax applies after the discount', () => {
  const t = computeTotals([{ quantity: '1', unitPrice: '200' }], {
    ...base,
    discountValue: '10',
    taxRate: '10',
  });
  assert.equal(t.discount, '20.00');
  assert.equal(t.tax, '18.00');
  assert.equal(t.total, '198.00');
});

test('fixed discount is clamped so the total is never negative', () => {
  const t = computeTotals([{ quantity: '1', unitPrice: '50' }], {
    ...base,
    discountType: 'amount',
    discountValue: '500',
  });
  assert.equal(t.discount, '50.00');
  assert.equal(t.total, '0.00');
});

test('zero-decimal and three-decimal currencies', () => {
  assert.equal(minorDigits('USD'), 2);
  assert.equal(minorDigits('JPY'), 0);
  assert.equal(minorDigits('KWD'), 3);
  const t = computeTotals([{ quantity: '3', unitPrice: '333.5' }], { ...base, currency: 'JPY' });
  assert.equal(t.subtotal, '1001'); // 1000.5 -> 1001
});

test('invalid numbers count as zero instead of throwing', () => {
  const t = computeTotals([{ quantity: 'abc', unitPrice: '10' }], base);
  assert.equal(t.total, '0.00');
  assert.equal(parseDecimal('1e3'), null);
  assert.equal(parseDecimal('12.50')?.toString(), '12.5');
});

test('sumNumbers adds exactly and ignores invalid entries', () => {
  assert.equal(sumNumbers(['0.1', '0.2', '', 'x']), '0.3');
  assert.equal(sumNumbers([]), '0');
});

test('sumAmounts rounds each amount to the currency, then adds', () => {
  assert.equal(sumAmounts(['1.005', '1.005'], 'USD'), '2.02');
  assert.equal(sumAmounts(['100', '250'], 'JPY'), '350');
  assert.equal(sumAmounts([], 'USD'), '0.00');
});
