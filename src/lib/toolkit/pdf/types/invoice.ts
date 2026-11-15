// Invoice: line items with exact currency math, discount, tax and an optional payment QR.
// The data shape is the same as the original standalone invoice tool, so PDFs made by it
// still load (see engine.ts).

import { defineDocType } from '../doctype';
import { formatDate, formatMoney, isoDate, isValidCurrency } from '../format';
import type { Block } from '../layout';
import { computeTotals, type DiscountType } from '../money';
import type { Field } from '../schema';
import { fileNameField, fileNameOf, money, number, pageFields, type PageSize } from './common';

interface Party {
  name: string;
  address: string;
  email: string;
  taxId: string;
}

export type InvoiceData = {
  filename: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  locale: string;
  pageSize: PageSize;
  accentColor: string;
  from: Party;
  to: Party;
  items: { description: string; quantity: string; unitPrice: string }[];
  discount: { type: DiscountType; value: string };
  taxLabel: string;
  taxRate: string;
  notes: string;
  terms: string;
  payment: { instructions: string; qrPayload: string; qrLabel: string };
};

const party = (): Field[] => [
  { kind: 'text', key: 'name', label: 'Name' },
  { kind: 'textarea', key: 'address', label: 'Address', rows: 3 },
  { kind: 'email', key: 'email', label: 'Email' },
  { kind: 'text', key: 'taxId', label: 'Tax ID' },
];

const fields: Field[] = [
  {
    kind: 'group',
    label: 'Details',
    fields: [
      fileNameField('invoice', (today) => `INV-${isoDate(today).replaceAll('-', '')}-001`),
      {
        kind: 'text',
        key: 'number',
        label: 'Invoice number',
        maxLength: 64,
        required: true,
        default: (today) => `INV-${isoDate(today).replaceAll('-', '')}-001`,
      },
      {
        kind: 'date',
        key: 'issueDate',
        label: 'Issue date',
        required: true,
        default: (t) => isoDate(t),
      },
      { kind: 'date', key: 'dueDate', label: 'Due date', default: (t) => isoDate(t, 30) },
      ...pageFields('#0f766e'),
    ],
  },
  { kind: 'group', key: 'from', label: 'From', half: true, stack: true, fields: party() },
  { kind: 'group', key: 'to', label: 'Bill to', half: true, stack: true, fields: party() },
  {
    kind: 'table',
    key: 'items',
    label: 'Line items',
    rowLabel: 'Line',
    addLabel: 'Add line',
    columns: [
      { key: 'description', label: 'Description', type: 'text' },
      {
        key: 'quantity',
        label: 'Qty',
        type: 'decimal',
        default: '1',
        width: '4.5rem',
        required: true,
      },
      { key: 'unitPrice', label: 'Unit price', type: 'decimal', default: '0.00', required: true },
      { key: 'amount', label: 'Amount', type: 'computed' },
    ],
  },
  {
    kind: 'group',
    label: 'Discount and tax',
    half: true,
    fields: [
      {
        kind: 'group',
        key: 'discount',
        fields: [
          {
            kind: 'select',
            key: 'type',
            label: 'Discount',
            default: 'percent',
            options: [
              { value: 'percent', label: 'Percent (%)' },
              { value: 'amount', label: 'Fixed amount' },
            ],
          },
          { kind: 'decimal', key: 'value', label: 'Discount value', default: '0', required: true },
        ],
      },
      { kind: 'text', key: 'taxLabel', label: 'Tax label', default: 'Tax', maxLength: 32 },
      { kind: 'decimal', key: 'taxRate', label: 'Tax rate (%)', default: '0', required: true },
    ],
  },
  { kind: 'summary', label: 'Totals', half: true },
  {
    kind: 'group',
    key: 'payment',
    label: 'Payment',
    stack: true,
    fields: [
      {
        kind: 'textarea',
        key: 'instructions',
        label: 'Instructions',
        rows: 3,
        placeholder: 'Bank name, account and routing numbers, or how to pay',
      },
      {
        kind: 'text',
        key: 'qrPayload',
        label: 'QR code content',
        placeholder: 'A payment link or URI. Leave empty for no QR code.',
      },
      { kind: 'text', key: 'qrLabel', label: 'QR caption', default: 'Scan to pay' },
    ],
  },
  {
    kind: 'group',
    label: 'Notes and terms',
    stack: true,
    fields: [
      { kind: 'textarea', key: 'notes', label: 'Notes', rows: 3 },
      { kind: 'textarea', key: 'terms', label: 'Terms', rows: 3 },
    ],
  },
];

function totalsOf(data: InvoiceData) {
  const code = data.currency.trim().toUpperCase();
  return computeTotals(data.items, {
    currency: isValidCurrency(code) ? code : 'USD',
    discountType: data.discount.type,
    discountValue: data.discount.value,
    taxRate: data.taxRate,
  });
}

export const invoice = defineDocType<InvoiceData>({
  id: 'invoice',
  label: 'Invoice',
  description:
    'Line items with exact currency math, discount, tax and an optional payment QR code.',
  fields,

  filename: (d) => fileNameOf(d.filename, 'invoice'),

  live(d) {
    const code = d.currency.trim().toUpperCase();
    const currency = isValidCurrency(code) ? code : 'USD';
    const t = totalsOf(d);
    const show = (amount: string) => {
      try {
        return formatMoney(amount, currency, d.locale);
      } catch {
        return amount;
      }
    };
    return {
      cells: Object.fromEntries(t.lines.map((line, i) => [`items.${i}.amount`, show(line)])),
      totals: [
        { label: 'Subtotal', value: show(t.subtotal) },
        {
          label: 'Discount',
          value: Number(t.discount) > 0 ? `-${show(t.discount)}` : show(t.discount),
        },
        { label: 'Tax', value: show(t.tax) },
        { label: 'Total due', value: show(t.total), strong: true },
      ],
    };
  },

  layout(d) {
    const t = totalsOf(d);
    const fmt = (amount: string) => money(amount, d.currency, d.locale);

    const meta: [string, string][] = [
      ['Invoice no.', d.number],
      ['Issued', formatDate(d.issueDate, d.locale)],
    ];
    if (d.dueDate) meta.push(['Due', formatDate(d.dueDate, d.locale)]);

    const partyColumn = (heading: string, p: Party) => ({
      heading,
      lines: [
        { text: p.name, style: 'strong' as const },
        { text: p.address },
        { text: p.email },
        { text: p.taxId.trim() ? `Tax ID: ${p.taxId}` : '' },
      ],
    });

    const totalRows: [string, string][] = [['Subtotal', fmt(t.subtotal)]];
    if (Number(t.discount) > 0) {
      const label =
        d.discount.type === 'percent' ? `Discount (${d.discount.value.trim()}%)` : 'Discount';
      totalRows.push([label, `-${fmt(t.discount)}`]);
    }
    if (Number(d.taxRate) > 0) {
      totalRows.push([`${d.taxLabel.trim() || 'Tax'} (${d.taxRate.trim()}%)`, fmt(t.tax)]);
    }

    const blocks: Block[] = [
      { kind: 'title', title: 'INVOICE', meta },
      { kind: 'columns', columns: [partyColumn('FROM', d.from), partyColumn('BILL TO', d.to)] },
      {
        kind: 'table',
        columns: [
          { label: 'Description' },
          { label: 'Qty', align: 'right', width: 56 },
          { label: 'Unit price', align: 'right', width: 86 },
          { label: 'Amount', align: 'right', width: 92, bold: true },
        ],
        rows: d.items.map((item, i) => [
          item.description,
          number(item.quantity, d.locale),
          fmt(item.unitPrice),
          fmt(t.lines[i]),
        ]),
      },
      { kind: 'totals', rows: totalRows, grand: ['Total due', fmt(t.total)] },
    ];

    const { instructions, qrPayload, qrLabel } = d.payment;
    if (instructions.trim() || qrPayload.trim()) {
      blocks.push({
        kind: 'text',
        heading: 'PAYMENT',
        text: instructions,
        qr: qrPayload.trim() ? { payload: qrPayload, caption: qrLabel } : undefined,
      });
    }
    blocks.push({ kind: 'text', heading: 'NOTES', text: d.notes, muted: true });
    blocks.push({ kind: 'text', heading: 'TERMS', text: d.terms, muted: true });

    return {
      pageSize: d.pageSize,
      accent: d.accentColor,
      title: `Invoice ${d.number}`,
      author: d.from.name,
      footer: `Invoice ${d.number}  -  Page {page} of {pages}`,
      blocks,
    };
  },

  example: {
    number: 'INV-0001',
    from: { name: 'Acme Studio', address: '1 Main St\nSpringfield', email: 'hello@acme.example' },
    to: { name: 'Client Co', address: '9 Side Rd\nShelbyville' },
    items: [
      { description: 'Design work', quantity: '1.5', unitPrice: '80' },
      { description: 'Hosting (annual)', quantity: '1', unitPrice: '12.34' },
    ],
    taxLabel: 'Sales tax',
    taxRate: '8.875',
    notes: 'Thank you for your business.',
  },
});
