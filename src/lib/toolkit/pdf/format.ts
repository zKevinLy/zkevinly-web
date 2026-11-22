// Display formatting via the platform Intl APIs: no locale tables shipped with the site.

/** Falls back to en-US when the tag is invalid or unsupported. */
export function safeLocale(locale: string): string {
  try {
    // A string always canonicalises to exactly one tag, or throws.
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return 'en-US';
  }
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

/** Formats an exact decimal string. Intl accepts numeric strings, so no float round trip. */
export function formatMoney(amount: string, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(safeLocale(locale), { style: 'currency', currency });
  return formatter.format(amount as unknown as number);
}

export function formatQuantity(quantity: string, locale: string): string {
  const formatter = new Intl.NumberFormat(safeLocale(locale), { maximumFractionDigits: 6 });
  return formatter.format(quantity as unknown as number);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "2026-11-14" -> "Nov 14, 2026" (locale-aware). Anything else is returned unchanged. */
export function formatDate(value: string, locale: string): string {
  if (!isIsoDate(value)) return value;
  const [y, m, d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(safeLocale(locale), {
    dateStyle: 'medium',
    timeZone: 'UTC', // a calendar date has no time zone; never let the viewer's shift it
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Local calendar date as YYYY-MM-DD, optionally N days ahead. */
export function isoDate(date: Date, plusDays = 0): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate() + plusDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${copy.getFullYear()}-${pad(copy.getMonth() + 1)}-${pad(copy.getDate())}`;
}
