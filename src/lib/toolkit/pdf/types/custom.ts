// Custom document: the fully user-defined type. Title, any number of label/value details,
// a table whose columns (name, alignment, format, width, total) are chosen in the form,
// and free text sections. Use it for packing lists, price sheets, timesheets, reports...

import { defineDocType } from '../doctype';
import { formatDate } from '../format';
import type { Block, TableColumn } from '../layout';
import { isValidDecimal, sumAmounts, sumNumbers } from '../money';
import type { Field, Sheet, SheetColumn } from '../schema';
import { fileNameField, fileNameOf, money, number, pageFields, type PageSize } from './common';

export type CustomData = {
  filename: string;
  kicker: string;
  title: string;
  subtitle: string;
  currency: string;
  locale: string;
  pageSize: PageSize;
  accentColor: string;
  detailsStyle: 'grid' | 'header';
  details: { label: string; value: string }[];
  tableHeading: string;
  table: Sheet;
  sections: { heading: string; body: string }[];
  footerText: string;
};

const defaultSheet: Sheet = {
  columns: [
    { label: 'Item', align: 'left', format: 'text', width: 4, sum: false },
    { label: 'Qty', align: 'right', format: 'number', width: 1, sum: true },
    { label: 'Amount', align: 'right', format: 'money', width: 2, sum: true },
  ],
  rows: [['', '', '']],
};

const fields: Field[] = [
  {
    kind: 'group',
    label: 'Document',
    fields: [
      fileNameField('document', 'Untitled document'),
      { kind: 'text', key: 'kicker', label: 'Small heading above the title' },
      { kind: 'text', key: 'title', label: 'Title', default: 'Untitled document' },
      { kind: 'text', key: 'subtitle', label: 'Subtitle' },
      { kind: 'text', key: 'footerText', label: 'Footer text' },
      {
        kind: 'select',
        key: 'detailsStyle',
        label: 'Show details',
        default: 'grid',
        options: [
          { value: 'grid', label: 'In a grid under the title' },
          { value: 'header', label: 'Beside the title' },
        ],
      },
      ...pageFields('#0f766e'),
    ],
  },
  {
    kind: 'table',
    key: 'details',
    label: 'Details',
    help: 'Label and value pairs, such as "Prepared by" and a name.',
    minRows: 0,
    rowLabel: 'Detail',
    addLabel: 'Add detail',
    columns: [
      { key: 'label', label: 'Label', type: 'text', width: 'minmax(0, 0.6fr)' },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },
  {
    kind: 'group',
    label: 'Table',
    fields: [{ kind: 'text', key: 'tableHeading', label: 'Table heading' }],
  },
  { kind: 'sheet', key: 'table', label: 'Columns and rows', default: defaultSheet },
  {
    kind: 'list',
    key: 'sections',
    label: 'Text sections',
    itemLabel: 'Section',
    titleKey: 'heading',
    addLabel: 'Add section',
    min: 0,
    fields: [
      { kind: 'text', key: 'heading', label: 'Heading' },
      { kind: 'textarea', key: 'body', label: 'Text', rows: 5 },
    ],
  },
];

function cell(value: string, column: SheetColumn, d: CustomData): string {
  switch (column.format) {
    case 'money':
      return money(value, d.currency, d.locale);
    case 'number':
      return number(value, d.locale);
    case 'date':
      return formatDate(value.trim(), d.locale);
    default:
      return value;
  }
}

function sumOf(column: SheetColumn, index: number, rows: string[][], d: CustomData): string {
  const values = rows.map((row) => row[index] ?? '').filter((v) => isValidDecimal(v.trim()));
  if (column.format === 'money') return money(sumAmounts(values, d.currency), d.currency, d.locale);
  return number(sumNumbers(values), d.locale);
}

export const custom = defineDocType<CustomData>({
  id: 'custom',
  label: 'Custom document',
  description:
    'Start from nothing: your own title, details, table columns (with optional totals) and text sections.',
  fields,

  filename: (d) => fileNameOf(d.filename, 'document'),

  layout(d) {
    const blocks: Block[] = [];
    const details = d.details
      .filter((row) => row.label.trim() || row.value.trim())
      .map((row): [string, string] => [row.label, row.value]);

    blocks.push({
      kind: 'title',
      kicker: d.kicker,
      title: d.title.trim() || 'Untitled document',
      subtitle: d.subtitle,
      meta: d.detailsStyle === 'header' ? details : undefined,
    });
    if (d.detailsStyle === 'grid' && details.length > 0) {
      blocks.push({ kind: 'facts', items: details, perRow: 3 });
    }

    const { columns, rows } = d.table;
    const filled = rows.filter((row) => row.some((value) => value.trim()));
    if (filled.length > 0) {
      const tableColumns: TableColumn[] = columns.map((column) => ({
        label: column.label,
        align: column.align,
        weight: column.width,
      }));
      let footer: string[] | undefined;
      if (columns.some((column) => column.sum)) {
        const firstPlain = columns.findIndex((column) => !column.sum);
        footer = columns.map((column, index) =>
          column.sum ? sumOf(column, index, filled, d) : index === firstPlain ? 'Total' : '',
        );
      }
      blocks.push({
        kind: 'table',
        heading: d.tableHeading,
        columns: tableColumns,
        rows: filled.map((row) => columns.map((column, i) => cell(row[i] ?? '', column, d))),
        footer,
      });
    }

    for (const section of d.sections) {
      blocks.push({ kind: 'text', heading: section.heading.toUpperCase(), text: section.body });
    }

    return {
      pageSize: d.pageSize,
      accent: d.accentColor,
      title: d.title.trim() || 'Untitled document',
      author: '',
      footer: `${d.footerText.trim() ? `${d.footerText.trim()}  -  ` : ''}Page {page} of {pages}`,
      blocks,
    };
  },

  example: {
    kicker: 'PACKING LIST',
    title: 'Camping trip',
    subtitle: 'Weekend, two people',
    details: [
      { label: 'Prepared by', value: 'Alex' },
      { label: 'Date', value: '2026-11-14' },
      { label: 'Destination', value: 'Lake Site 12' },
    ],
    table: {
      columns: [
        { label: 'Item', align: 'left', format: 'text', width: 4, sum: false },
        { label: 'Qty', align: 'right', format: 'number', width: 1, sum: true },
        { label: 'Est. cost', align: 'right', format: 'money', width: 2, sum: true },
      ],
      rows: [
        ['Tent', '1', '120'],
        ['Sleeping bags', '2', '85.50'],
        ['Camp stove', '1', '39.99'],
      ],
    },
    sections: [{ heading: 'Reminders', body: 'Check the fire ban.\nDownload offline maps.' }],
  },
});
