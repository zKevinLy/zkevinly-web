// What a document type is. A type is plain data plus two small functions: its `fields` (which
// drive the form, the defaults, the sanitizer and the validation, see schema.ts) and a
// `layout()` that turns clean data into blocks for the renderer (see layout.ts).
//
// To add a type: write one file in types/, then add it to the list in types/index.ts.

import type { Layout } from './layout';
import type { Data, Field, Problem } from './schema';

export interface LiveInfo {
  /** Text for `computed` table columns, keyed by path: "items.0.amount". */
  cells?: Record<string, string>;
  /** Rows of the `summary` card. */
  totals?: { label: string; value: string; strong?: boolean }[];
}

export interface DocType<D = Data> {
  /** Stable id: used in the URL (?type=invoice) and stored in every PDF made by the tool. */
  id: string;
  label: string;
  description: string;
  fields: Field[];
  /** Gets sanitized data: every key present and the right type (see sanitize()). */
  layout(data: D): Layout;
  /** File name without extension. */
  filename(data: D): string;
  /** `live` and `validate` get the in-progress form data, so values may be invalid. */
  live?(data: D): LiveInfo;
  /** Problems the fields cannot express. Fields already report bad dates and numbers. */
  validate?(data: D): Problem[];
  /** A filled-in sample for the "Load example" button. */
  example?: Data;
}

export type AnyDocType = DocType<Data>;

/** Registers a type with its own data shape `D` in the list of all types. */
export function defineDocType<D>(type: DocType<D>): AnyDocType {
  return type as unknown as AnyDocType;
}
