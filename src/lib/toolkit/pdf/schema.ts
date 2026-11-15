// The field schema. A document type describes its data once, as a list of fields, and this
// module derives everything else from that description:
//   - defaultsOf(): a fresh, valid data object
//   - sanitize():   untrusted JSON (a file, or the attachment of a PDF someone sent you)
//                   turned into a clean data object: unknown keys dropped, types coerced
//   - validateFields(): human-readable problems
// The form UI (ui/form.ts) renders from the same list, so a new type never needs its own
// parser, validator or HTML.

import { isIsoDate, isValidCurrency, safeLocale } from './format';
import { isValidDecimal } from './money';

export type Data = Record<string, unknown>;

export const MAX_TEXT = 10_000;
export const MAX_ROWS = 500;
export const MAX_SHEET_COLUMNS = 12;

type Default = string | ((today: Date) => string);

interface Base {
  key: string;
  label: string;
  /** Small hint shown under the input. */
  help?: string;
}

/** One-value fields. `currency` and `locale` are text with built-in clean-up. */
export interface ScalarField extends Base {
  kind: 'text' | 'textarea' | 'email' | 'date' | 'decimal' | 'color' | 'currency' | 'locale';
  default?: Default;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Autocomplete suggestions (a <datalist>); any value is still accepted. */
  suggestions?: readonly string[];
  /** Empty is reported as a problem (decimals: empty is otherwise fine). */
  required?: boolean;
}

export interface SelectField extends Base {
  kind: 'select';
  options: readonly { value: string; label: string }[];
  default: string;
}

/**
 * A card of fields. With a `key` the fields are nested under it in the data; without one it
 * is only a visual section and the fields stay on the parent object.
 */
export interface GroupField {
  kind: 'group';
  key?: string;
  label?: string;
  fields: Field[];
  /** Two half-width cards sit side by side on wide screens. */
  half?: boolean;
  /** One input per line instead of a responsive grid. */
  stack?: boolean;
}

export interface Column {
  key: string;
  label: string;
  /** `computed` columns are shown but never stored: the type's `live()` fills them. */
  type: 'text' | 'textarea' | 'decimal' | 'computed';
  default?: string;
  /** CSS grid track, e.g. "6.5rem". Defaults by type. */
  width?: string;
  required?: boolean;
}

/** Rows of fixed, type-defined columns. */
export interface TableField extends Base {
  kind: 'table';
  columns: Column[];
  minRows?: number;
  addLabel?: string;
  /** Used in messages: "Line 3: Qty is not a number." */
  rowLabel?: string;
}

/** A repeatable group of fields: each item is its own card (records, sections, ...). */
export interface ListField extends Base {
  kind: 'list';
  fields: Field[];
  itemLabel: string;
  /** Key of a text field whose value titles the card. */
  titleKey?: string;
  min?: number;
  addLabel?: string;
}

export type Align = 'left' | 'right' | 'center';
export type CellFormat = 'text' | 'number' | 'money' | 'date';

export interface SheetColumn {
  label: string;
  align: Align;
  format: CellFormat;
  /** Relative width, 1 to 8. */
  width: number;
  /** Add a total for this column in the table footer (number and money columns). */
  sum: boolean;
}

export interface Sheet {
  columns: SheetColumn[];
  rows: string[][];
}

/** A table whose columns are data too: the person using the tool defines them. */
export interface SheetField extends Base {
  kind: 'sheet';
  default: Sheet;
}

/** A read-only card showing the type's live totals. */
export interface SummaryField {
  kind: 'summary';
  label: string;
  half?: boolean;
}

export type Field =
  ScalarField | SelectField | GroupField | TableField | ListField | SheetField | SummaryField;

export interface Problem {
  message: string;
  /** A fatal problem stops the PDF from being built (the preview shows it instead). */
  fatal?: boolean;
}

export const isObj = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function defaultColumnWidth(column: Column): string {
  return (
    column.width ??
    (column.type === 'text' || column.type === 'textarea' ? 'minmax(0, 1fr)' : '6.5rem')
  );
}

// ---- Defaults -------------------------------------------------------------------------------

function scalarDefault(field: ScalarField, today: Date): string {
  return typeof field.default === 'function' ? field.default(today) : (field.default ?? '');
}

export function rowDefaults(columns: readonly Column[]): Data {
  const row: Data = {};
  for (const column of columns)
    if (column.type !== 'computed') row[column.key] = column.default ?? '';
  return row;
}

function fillDefaults(fields: readonly Field[], target: Data, today: Date): void {
  for (const field of fields) {
    switch (field.kind) {
      case 'group':
        if (field.key) target[field.key] = defaultsOf(field.fields, today);
        else fillDefaults(field.fields, target, today);
        break;
      case 'table':
        target[field.key] = Array.from({ length: field.minRows ?? 1 }, () =>
          rowDefaults(field.columns),
        );
        break;
      case 'list':
        target[field.key] = Array.from({ length: field.min ?? 1 }, () =>
          defaultsOf(field.fields, today),
        );
        break;
      case 'sheet':
        target[field.key] = clone(field.default);
        break;
      case 'select':
        target[field.key] = field.default;
        break;
      case 'summary':
        break;
      default:
        target[field.key] = scalarDefault(field, today);
    }
  }
}

export function defaultsOf(fields: readonly Field[], today: Date = new Date()): Data {
  const data: Data = {};
  fillDefaults(fields, data, today);
  return data;
}

// ---- Sanitizing -----------------------------------------------------------------------------

/** Strings only (numbers are accepted and stringified), length-capped. */
function text(value: unknown, fallback: string, max = MAX_TEXT): string {
  if (typeof value === 'string') return value.slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function scalar(field: ScalarField, value: unknown, today: Date): string {
  const fallback = scalarDefault(field, today);
  const raw = text(value, fallback, field.maxLength ?? MAX_TEXT);
  switch (field.kind) {
    case 'color':
      return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
    case 'currency': {
      const code = raw.trim().toUpperCase();
      return isValidCurrency(code) ? code : fallback;
    }
    case 'locale':
      return safeLocale(raw.trim() || fallback);
    default:
      return raw;
  }
}

function sanitizeRow(columns: readonly Column[], source: Data): Data {
  const row: Data = {};
  for (const column of columns) {
    if (column.type !== 'computed')
      row[column.key] = text(source[column.key], column.default ?? '');
  }
  return row;
}

function sanitizeSheet(field: SheetField, value: unknown): Sheet {
  const source = isObj(value) ? value : {};
  const rawColumns = Array.isArray(source.columns)
    ? (source.columns as unknown[]).slice(0, MAX_SHEET_COLUMNS).filter(isObj)
    : [];
  const columns: SheetColumn[] = rawColumns.map((column) => {
    const width = typeof column.width === 'number' ? Math.round(column.width) : 1;
    return {
      label: text(column.label, '', 200),
      align: column.align === 'right' || column.align === 'center' ? column.align : 'left',
      format:
        column.format === 'number' || column.format === 'money' || column.format === 'date'
          ? column.format
          : 'text',
      width: Math.min(8, Math.max(1, Number.isFinite(width) ? width : 1)),
      sum: column.sum === true,
    };
  });
  if (columns.length === 0) return clone(field.default);
  const rawRows = Array.isArray(source.rows) ? (source.rows as unknown[]).slice(0, MAX_ROWS) : [];
  const rows = rawRows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => columns.map((_, index) => text(row[index], '')));
  return { columns, rows };
}

function fillSanitized(fields: readonly Field[], source: Data, target: Data, today: Date): void {
  for (const field of fields) {
    switch (field.kind) {
      case 'group':
        if (field.key) target[field.key] = sanitize(field.fields, source[field.key], today);
        else fillSanitized(field.fields, source, target, today);
        break;
      case 'table': {
        const raw = Array.isArray(source[field.key]) ? (source[field.key] as unknown[]) : [];
        const rows = raw
          .slice(0, MAX_ROWS)
          .filter(isObj)
          .map((row) => sanitizeRow(field.columns, row));
        while (rows.length < (field.minRows ?? 1)) rows.push(rowDefaults(field.columns));
        target[field.key] = rows;
        break;
      }
      case 'list': {
        const raw = Array.isArray(source[field.key]) ? (source[field.key] as unknown[]) : [];
        const items = raw
          .slice(0, MAX_ROWS)
          .filter(isObj)
          .map((item) => sanitize(field.fields, item, today));
        while (items.length < (field.min ?? 1)) items.push(defaultsOf(field.fields, today));
        target[field.key] = items;
        break;
      }
      case 'sheet':
        target[field.key] = sanitizeSheet(field, source[field.key]);
        break;
      case 'select':
        target[field.key] = field.options.some((option) => option.value === source[field.key])
          ? source[field.key]
          : field.default;
        break;
      case 'summary':
        break;
      default:
        target[field.key] = scalar(field, source[field.key], today);
    }
  }
}

/**
 * Turns untrusted input into data that is guaranteed to match the fields: every key present,
 * every value the right type, nothing else. Types can rely on this in their `layout()`.
 */
export function sanitize(fields: readonly Field[], input: unknown, today: Date = new Date()): Data {
  const target: Data = {};
  fillSanitized(fields, isObj(input) ? input : {}, target, today);
  return target;
}

// ---- Validation -----------------------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function validateScalar(field: ScalarField, value: unknown, prefix: string): Problem[] {
  const v = str(value);
  const label = `${prefix}${field.label}`;
  if (field.kind === 'currency') {
    return isValidCurrency(v.trim().toUpperCase())
      ? []
      : [
          {
            message: 'Currency must be a valid 3-letter ISO code, such as USD or EUR.',
            fatal: true,
          },
        ];
  }
  if (!v.trim()) return field.required ? [{ message: `${label} is empty.` }] : [];
  if (field.kind === 'date' && !isIsoDate(v)) return [{ message: `${label} is not a valid date.` }];
  if (field.kind === 'decimal' && !isValidDecimal(v))
    return [{ message: `${label} is not a number.` }];
  return [];
}

export function validateFields(fields: readonly Field[], data: Data, prefix = ''): Problem[] {
  const problems: Problem[] = [];
  for (const field of fields) {
    switch (field.kind) {
      case 'group': {
        const inner = field.key ? data[field.key] : data;
        if (isObj(inner)) problems.push(...validateFields(field.fields, inner, prefix));
        break;
      }
      case 'table': {
        const rows = Array.isArray(data[field.key]) ? (data[field.key] as unknown[]) : [];
        rows.filter(isObj).forEach((row, index) => {
          for (const column of field.columns) {
            if (column.type !== 'decimal') continue;
            const v = str(row[column.key]);
            const where = `${field.rowLabel ?? 'Row'} ${index + 1}: ${column.label}`;
            if (!v.trim()) {
              if (column.required) problems.push({ message: `${where} is not a number.` });
            } else if (!isValidDecimal(v)) {
              problems.push({ message: `${where} is not a number.` });
            }
          }
        });
        break;
      }
      case 'list': {
        const items = Array.isArray(data[field.key]) ? (data[field.key] as unknown[]) : [];
        items.filter(isObj).forEach((item, index) => {
          problems.push(
            ...validateFields(field.fields, item, `${prefix}${field.itemLabel} ${index + 1}: `),
          );
        });
        break;
      }
      case 'sheet': {
        const sheet = data[field.key];
        if (!isObj(sheet) || !Array.isArray(sheet.columns) || !Array.isArray(sheet.rows)) break;
        const columns = sheet.columns.filter(isObj);
        (sheet.rows as unknown[]).forEach((row, rowIndex) => {
          if (!Array.isArray(row)) return;
          columns.forEach((column, index) => {
            const v = str(row[index]);
            if (!v.trim()) return;
            if (column.format === 'date' && !isIsoDate(v)) {
              problems.push({
                message: `${prefix}Row ${rowIndex + 1}: "${str(column.label)}" is not a valid date (YYYY-MM-DD).`,
              });
            }
            if ((column.format === 'number' || column.format === 'money') && !isValidDecimal(v)) {
              problems.push({
                message: `${prefix}Row ${rowIndex + 1}: "${str(column.label)}" is not a number.`,
              });
            }
          });
        });
        break;
      }
      case 'summary':
      case 'select': // sanitize() already forces a valid option
        break;
      default:
        problems.push(...validateScalar(field, data[field.key], prefix));
    }
  }
  return problems;
}
