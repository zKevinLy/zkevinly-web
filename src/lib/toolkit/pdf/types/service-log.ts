// Service log: one record per page, for maintenance histories, inspections, repairs or any
// other "thing that was done on a date". Built for archiving (Paperless-ngx style): every
// record carries its own ID, status and source, and the PDF stays editable through the
// embedded config. Shared settings (asset, archive metadata, labels) apply to every record.

import { defineDocType } from '../doctype';
import type { Block, TextLine } from '../layout';
import { sumAmounts } from '../money';
import type { Field } from '../schema';
import { fileNameField, fileNameOf, money, pageFields, pairs, type PageSize } from './common';

type ServiceRecord = {
  title: string;
  recordId: string;
  date: string;
  odometer: string;
  status: string;
  source: string;
  createdDate: string;
  items: { item: string; details: string; amount: string }[];
  originalNote: string;
};

export type ServiceLogData = {
  filename: string;
  heading: string;
  category: string;
  currency: string;
  locale: string;
  pageSize: PageSize;
  accentColor: string;
  showAmounts: 'yes' | 'no';
  footerText: string;
  assetHeading: string;
  assetName: string;
  archiveName: string;
  metadataHeading: string;
  correspondent: string;
  documentType: string;
  detailsHeading: string;
  noteHeading: string;
  totalLabel: string;
  records: ServiceRecord[];
};

const fields: Field[] = [
  {
    kind: 'group',
    label: 'Log',
    fields: [
      fileNameField('service-log', 'Service log'),
      { kind: 'text', key: 'heading', label: 'Page heading', default: 'SERVICE RECORD' },
      { kind: 'text', key: 'category', label: 'Category', placeholder: 'e.g. Camry maintenance' },
      { kind: 'text', key: 'footerText', label: 'Footer text', default: 'Service log' },
      {
        kind: 'select',
        key: 'showAmounts',
        label: 'Amounts',
        default: 'yes',
        options: [
          { value: 'yes', label: 'Show amounts' },
          { value: 'no', label: 'Hide amounts' },
        ],
      },
      ...pageFields('#0f766e'),
    ],
  },
  {
    kind: 'group',
    label: 'Asset',
    half: true,
    stack: true,
    fields: [
      { kind: 'text', key: 'assetHeading', label: 'Heading', default: 'ASSET' },
      { kind: 'text', key: 'assetName', label: 'Name', placeholder: 'e.g. Toyota Camry' },
      {
        kind: 'text',
        key: 'archiveName',
        label: 'Log or archive name',
        placeholder: 'e.g. Maintenance Log Archive',
      },
    ],
  },
  {
    kind: 'group',
    label: 'Archive metadata',
    half: true,
    stack: true,
    fields: [
      { kind: 'text', key: 'metadataHeading', label: 'Heading', default: 'ARCHIVE METADATA' },
      { kind: 'text', key: 'correspondent', label: 'Correspondent' },
      { kind: 'text', key: 'documentType', label: 'Document type', default: 'Maintenance record' },
    ],
  },
  {
    kind: 'group',
    label: 'Labels',
    fields: [
      { kind: 'text', key: 'detailsHeading', label: 'Details heading', default: 'SERVICE DETAILS' },
      {
        kind: 'text',
        key: 'noteHeading',
        label: 'Original note heading',
        default: 'ORIGINAL NOTE',
      },
      { kind: 'text', key: 'totalLabel', label: 'Total label', default: 'Total recorded' },
    ],
  },
  {
    kind: 'list',
    key: 'records',
    label: 'Records',
    itemLabel: 'Record',
    titleKey: 'title',
    addLabel: 'Add record',
    fields: [
      {
        kind: 'group',
        fields: [
          { kind: 'text', key: 'title', label: 'Service item', required: true },
          { kind: 'text', key: 'recordId', label: 'Record ID' },
          { kind: 'text', key: 'date', label: 'Service date', placeholder: 'YYYY-MM-DD' },
          { kind: 'text', key: 'odometer', label: 'Odometer' },
          { kind: 'text', key: 'status', label: 'Status', default: 'Completed' },
          { kind: 'text', key: 'source', label: 'Source', placeholder: 'e.g. Grocy task #1' },
          {
            kind: 'text',
            key: 'createdDate',
            label: 'Archive created date',
            help: 'Empty uses the service date.',
          },
        ],
      },
      {
        kind: 'table',
        key: 'items',
        label: 'Service details',
        help: 'An empty service item reuses the record title.',
        rowLabel: 'Item',
        addLabel: 'Add item',
        columns: [
          { key: 'item', label: 'Service item', type: 'text' },
          { key: 'details', label: 'Details / notes', type: 'textarea' },
          { key: 'amount', label: 'Amount', type: 'decimal', default: '0.00' },
        ],
      },
      { kind: 'textarea', key: 'originalNote', label: 'Original note entry', rows: 3 },
    ],
  },
];

export const serviceLog = defineDocType<ServiceLogData>({
  id: 'service-log',
  label: 'Service log',
  description:
    'One record per page for maintenance, repairs or inspections, with archive metadata and a PDF that stays editable.',
  fields,

  filename: (d) => fileNameOf(d.filename, 'service-log'),

  layout(d) {
    const fmt = (amount: string) => money(amount, d.currency, d.locale);
    const showAmounts = d.showAmounts === 'yes';
    const blocks: Block[] = [];

    d.records.forEach((r, index) => {
      if (index > 0) blocks.push({ kind: 'pageBreak' });

      blocks.push({
        kind: 'title',
        kicker: d.heading,
        title: r.title.trim() || 'Untitled record',
        size: 20,
        subtitle: d.category.trim() ? `Category: ${d.category}` : undefined,
        meta: pairs([
          ['Record ID', r.recordId],
          ['Service Date', r.date],
          ['Odometer', r.odometer],
          ['Status', r.status],
        ]),
      });

      const asset: TextLine[] = [
        { text: d.assetName, style: 'strong' },
        { text: d.archiveName },
        { text: r.source.trim() ? `Source: ${r.source}` : '' },
      ];
      const created = r.createdDate.trim() || r.date;
      const archive: TextLine[] = pairs([
        ['Correspondent', d.correspondent],
        ['Document Type', d.documentType],
        ['Created Date', created],
      ]).map(([label, value]) => ({ text: `${label}: ${value}` }));
      const columns = [
        { heading: d.assetHeading, lines: asset },
        { heading: d.metadataHeading, lines: archive },
      ].filter((column) => column.lines.some((line) => line.text.trim()));
      if (columns.length > 0) blocks.push({ kind: 'columns', columns });

      blocks.push({
        kind: 'table',
        heading: d.detailsHeading,
        columns: [
          { label: '#', width: 22 },
          { label: 'Service item', weight: 2 },
          { label: 'Details / notes', weight: 3 },
          ...(showAmounts
            ? [{ label: 'Amount', align: 'right' as const, width: 90, bold: true }]
            : []),
        ],
        rows: r.items.map((item, i) => [
          String(i + 1),
          item.item.trim() || r.title,
          item.details,
          ...(showAmounts ? [fmt(item.amount)] : []),
        ]),
      });

      if (showAmounts) {
        const total = fmt(
          sumAmounts(
            r.items.map((item) => item.amount),
            d.currency,
          ),
        );
        blocks.push({ kind: 'totals', rows: [['Subtotal', total]], grand: [d.totalLabel, total] });
      }
      blocks.push({ kind: 'text', heading: d.noteHeading, text: r.originalNote, mono: true });
    });

    return {
      pageSize: d.pageSize,
      accent: d.accentColor,
      title: d.footerText.trim() || 'Service log',
      author: '',
      subject: `${d.records.length} ${d.records.length === 1 ? 'record' : 'records'}`,
      footer: `${d.footerText.trim() ? `${d.footerText.trim()} \u2022 ` : ''}Page {page} of {pages}`,
      blocks,
    };
  },

  example: {
    heading: 'VEHICLE SERVICE RECORD',
    category: 'Family car',
    footerText: 'Family car maintenance log',
    assetName: 'Example Sedan',
    archiveName: 'Maintenance Log Archive',
    correspondent: 'Family car',
    records: [
      {
        title: 'Oil change',
        recordId: 'SVC-001',
        date: '2026-03-01',
        odometer: '112,000 miles',
        source: 'Task #12',
        items: [{ item: '', details: 'Engine oil and filter changed.', amount: '49.99' }],
        originalNote: '2026-03-01\n112k',
      },
      {
        title: 'Cabin air filter',
        recordId: 'SVC-002',
        date: '2026-05-14',
        items: [{ item: '', details: 'Cabin filter replaced.', amount: '0' }],
      },
    ],
  },
});
