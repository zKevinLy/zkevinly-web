// Exact currency math. Amounts are decimal strings in the document JSON and Decimal values
// here, never JS floats, so 0.1 + 0.2 is 0.3 and tax rounding is predictable.

import Decimal from 'decimal.js';

/** Isolated Decimal: half-up rounding (what invoices expect) without touching global config. */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type DiscountType = 'percent' | 'amount';

export interface MoneyLine {
  quantity: string;
  unitPrice: string;
}

export interface Totals {
  /** Rounded amount of each line, in input order. */
  lines: string[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}

/** Minor-unit digits for a currency (2 for USD, 0 for JPY, 3 for KWD). Falls back to 2. */
export function minorDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/** Parses a plain decimal string ("12", "12.50", ".5"). Returns null for anything else. */
export function parseDecimal(value: string): Decimal | null {
  const trimmed = value.trim();
  if (!NUMBER.test(trimmed)) return null;
  return new D(trimmed);
}

/** Like parseDecimal but invalid or empty input counts as zero (for live totals). */
function numberOrZero(value: string): Decimal {
  return parseDecimal(value) ?? new D(0);
}

export function isValidDecimal(value: string): boolean {
  return parseDecimal(value) !== null;
}

export function computeTotals(
  items: MoneyLine[],
  options: {
    currency: string;
    discountType: DiscountType;
    discountValue: string;
    /** Tax rate in percent, e.g. "8.875". */
    taxRate: string;
  },
): Totals {
  const digits = minorDigits(options.currency);
  const round = (value: Decimal) => value.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP);

  const lines = items.map((item) =>
    round(numberOrZero(item.quantity).times(numberOrZero(item.unitPrice))),
  );
  const subtotal = lines.reduce((sum, line) => sum.plus(line), new D(0));

  const discountValue = Decimal.max(numberOrZero(options.discountValue), 0);
  const rawDiscount =
    options.discountType === 'percent'
      ? round(subtotal.times(discountValue).dividedBy(100))
      : round(discountValue);
  // A discount can never push the invoice below zero.
  const discount = Decimal.min(Decimal.max(rawDiscount, 0), Decimal.max(subtotal, 0));

  const taxable = subtotal.minus(discount);
  const tax = round(taxable.times(Decimal.max(numberOrZero(options.taxRate), 0)).dividedBy(100));
  const total = taxable.plus(tax);

  const fixed = (value: Decimal) => value.toFixed(digits);
  return {
    lines: lines.map(fixed),
    subtotal: fixed(subtotal),
    discount: fixed(discount),
    tax: fixed(tax),
    total: fixed(total),
  };
}

/** Exact sum of decimal strings (invalid or empty entries count as zero), no rounding. */
export function sumNumbers(values: string[]): string {
  return values.reduce((sum, value) => sum.plus(numberOrZero(value)), new D(0)).toFixed();
}

/** Sum of money amounts: each is rounded to the currency's minor unit first, like invoice lines. */
export function sumAmounts(values: string[], currency: string): string {
  const digits = minorDigits(currency);
  return values
    .reduce(
      (sum, value) => sum.plus(numberOrZero(value).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)),
      new D(0),
    )
    .toFixed(digits);
}
