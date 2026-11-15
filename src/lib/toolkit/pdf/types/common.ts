// Fields and helpers shared by the document types.

import { formatDate, formatMoney, formatQuantity } from '../format';
import { isValidDecimal } from '../money';
import type { PageSize } from '../layout';
import type { Field, ScalarField, SelectField } from '../schema';

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'NZD',
  'JPY',
  'CHF',
  'SEK',
  'INR',
  'MXN',
];
export const LOCALES = [
  'en-US',
  'en-GB',
  'en-CA',
  'en-AU',
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'ja-JP',
];

export type { PageSize };

export const currencyField = (): ScalarField => ({
  kind: 'currency',
  key: 'currency',
  label: 'Currency',
  default: 'USD',
  maxLength: 3,
  suggestions: CURRENCIES,
});

export const localeField = (): ScalarField => ({
  kind: 'locale',
  key: 'locale',
  label: 'Number and date format',
  default: 'en-US',
  suggestions: LOCALES,
});

export const pageSizeField = (): SelectField => ({
  kind: 'select',
  key: 'pageSize',
  label: 'Page size',
  default: 'Letter',
  options: [
    { value: 'Letter', label: 'US Letter' },
    { value: 'A4', label: 'A4' },
  ],
});

/** Every type names its downloaded files the same way: with the user's own "File name". */
export const fileNameField = (
  fallback: string,
  fill: ScalarField['default'] = '',
): ScalarField => ({
  kind: 'text',
  key: 'filename',
  label: 'File name',
  default: fill,
  placeholder: fallback,
  maxLength: 100,
  help: 'Used for the downloaded PDF and JSON files (without the extension).',
});

/** The file name (no extension): `data.filename`, or the type's fallback when it is empty. */
export const fileNameOf = (typed: string, fallback: string): string => slug(typed, fallback);

export const accentField = (color: string): ScalarField => ({
  kind: 'color',
  key: 'accentColor',
  label: 'Accent color',
  default: color,
});

/** The usual page-level settings, in one row of the form. */
export const pageFields = (color: string, withCurrency = true): Field[] => [
  ...(withCurrency ? [currencyField()] : []),
  localeField(),
  pageSizeField(),
  accentField(color),
];

/** Display helpers: never throw, and show what was typed when it is not a valid value. */
export function money(value: string, currency: string, locale: string): string {
  const v = value.trim();
  if (!v) return '';
  return isValidDecimal(v) ? formatMoney(v, currency, locale) : value;
}

export function number(value: string, locale: string): string {
  const v = value.trim();
  if (!v) return '';
  return isValidDecimal(v) ? formatQuantity(v, locale) : value;
}

export const date = (value: string, locale: string): string => formatDate(value.trim(), locale);

/** A safe file-name part: letters, digits, dot, dash, underscore. */
export function slug(value: string, fallback: string): string {
  return (
    value
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

/** Non-empty [label, value] pairs. */
export function pairs(items: [string, string][]): [string, string][] {
  return items.filter(([, value]) => value.trim());
}
