// The layout IR. A document type turns its data into a Layout: a page setup plus a flat list
// of blocks. The renderer (render.ts) knows how to draw each block kind and how to paginate,
// and knows nothing about invoices, records or any other type. Everything in a block is
// already a display string: money, dates and numbers are formatted by the type.

export type PageSize = 'A4' | 'Letter';

export type TextStyle = 'strong' | 'muted' | 'plain';

export interface TextLine {
  text: string;
  style?: TextStyle;
}

export type Align = 'left' | 'right' | 'center';

export interface TableColumn {
  label: string;
  align?: Align;
  /** Fixed width in points. Columns without one share the remaining width by `weight`. */
  width?: number;
  /** Relative share of the remaining width. Default 1. */
  weight?: number;
  bold?: boolean;
}

/** Big title on the left, optional label/value pairs stacked on the right. */
export interface TitleBlock {
  kind: 'title';
  title: string;
  /** Small caps line above the title. */
  kicker?: string;
  subtitle?: string;
  /** Title size in points. Default 26. */
  size?: number;
  meta?: [label: string, value: string][];
}

/** Side by side text columns with a small heading each (From / Bill to, Asset / Archive...). */
export interface ColumnsBlock {
  kind: 'columns';
  columns: { heading?: string; lines: TextLine[] }[];
}

/** A grid of small label-over-value facts. */
export interface FactsBlock {
  kind: 'facts';
  heading?: string;
  items: [label: string, value: string][];
  /** Facts per row. Default 3. */
  perRow?: number;
}

export interface TableBlock {
  kind: 'table';
  heading?: string;
  columns: TableColumn[];
  rows: string[][];
  /** Bold summary row under the table (totals). Empty strings leave cells blank. */
  footer?: string[];
}

/** Right-aligned label/value rows with an emphasised grand total underneath. */
export interface TotalsBlock {
  kind: 'totals';
  rows: [label: string, value: string][];
  grand?: [label: string, value: string];
}

/** A heading and a paragraph, optionally with a QR code on the right. */
export interface TextBlock {
  kind: 'text';
  heading?: string;
  text: string;
  /** Muted body text (notes, terms) instead of ink. */
  muted?: boolean;
  /** Monospaced, for raw notes and codes. */
  mono?: boolean;
  qr?: { payload: string; caption?: string };
}

export interface SpacerBlock {
  kind: 'spacer';
  height: number;
}

/** Starts a new page (ignored when the current page is still empty). */
export interface PageBreakBlock {
  kind: 'pageBreak';
}

export type Block =
  | TitleBlock
  | ColumnsBlock
  | FactsBlock
  | TableBlock
  | TotalsBlock
  | TextBlock
  | SpacerBlock
  | PageBreakBlock;

export interface Layout {
  pageSize: PageSize;
  /** #rrggbb */
  accent: string;
  /** PDF metadata. */
  title: string;
  author: string;
  subject?: string;
  /** Footer on every page. `{page}` and `{pages}` are replaced. */
  footer: string;
  blocks: Block[];
}
