import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatMoney,
  isIsoDate,
  isValidCurrency,
  isoDate,
  safeLocale,
} from '../../../../src/lib/toolkit/pdf/format';

test('formatMoney keeps exact decimals', () => {
  assert.equal(formatMoney('1234.50', 'USD', 'en-US'), '$1,234.50');
  assert.equal(formatMoney('0.30', 'USD', 'en-US'), '$0.30');
});

test('formatDate does not shift with the machine time zone', () => {
  assert.equal(formatDate('2026-11-14', 'en-US'), 'Nov 14, 2026');
  assert.equal(formatDate('garbage', 'en-US'), 'garbage');
});

test('date and currency checks', () => {
  assert.equal(isIsoDate('2026-02-28'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isValidCurrency('EUR'), true);
  assert.equal(isValidCurrency('eur'), false);
  assert.equal(isValidCurrency('ZZZ9'), false);
});

test('safeLocale falls back', () => {
  assert.equal(safeLocale('de-DE'), 'de-DE');
  assert.equal(safeLocale('%%%'), 'en-US');
});

test('isoDate adds days across month ends', () => {
  assert.equal(isoDate(new Date(2026, 0, 31), 1), '2026-02-01');
});
