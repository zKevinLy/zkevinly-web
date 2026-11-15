import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROWS,
  defaultsOf,
  sanitize,
  validateFields,
  type Field,
} from '../../../../src/lib/toolkit/pdf/schema';

const fields: Field[] = [
  { kind: 'text', key: 'name', label: 'Name', default: 'x', required: true },
  { kind: 'date', key: 'when', label: 'When', default: (today) => today.getFullYear().toString() },
  { kind: 'currency', key: 'currency', label: 'Currency', default: 'USD' },
  { kind: 'color', key: 'color', label: 'Color', default: '#0f766e' },
  {
    kind: 'select',
    key: 'size',
    label: 'Size',
    default: 'A',
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
    ],
  },
  {
    kind: 'group',
    key: 'nested',
    fields: [{ kind: 'decimal', key: 'rate', label: 'Rate', default: '1' }],
  },
  {
    kind: 'group',
    label: 'Section',
    fields: [{ kind: 'text', key: 'flat', label: 'Flat', default: 'f' }],
  },
  {
    kind: 'table',
    key: 'rows',
    label: 'Rows',
    rowLabel: 'Line',
    columns: [
      { key: 'a', label: 'A', type: 'text' },
      { key: 'n', label: 'N', type: 'decimal', default: '1', required: true },
      { key: 'sum', label: 'Sum', type: 'computed' },
    ],
  },
  {
    kind: 'list',
    key: 'items',
    label: 'Items',
    itemLabel: 'Item',
    min: 0,
    fields: [{ kind: 'text', key: 't', label: 'T', required: true }],
  },
];

test('defaultsOf builds a complete object (computed columns are not stored)', () => {
  const d = defaultsOf(fields, new Date(2026, 10, 14));
  assert.equal(d.when, '2026');
  assert.deepEqual(d.nested, { rate: '1' });
  assert.equal(d.flat, 'f'); // a group without a key keeps its fields on the parent
  assert.deepEqual(d.rows, [{ a: '', n: '1' }]);
  assert.deepEqual(d.items, []);
});

test('sanitize drops unknown keys and coerces numbers to strings', () => {
  const d = sanitize(fields, { evil: '<script>', name: 5, rows: [{ a: 'x', n: 2.5, extra: 1 }] });
  assert.equal('evil' in d, false);
  assert.equal(d.name, '5');
  assert.deepEqual(d.rows, [{ a: 'x', n: '2.5' }]);
});

test('sanitize repairs currency, color and select values', () => {
  const d = sanitize(fields, { currency: 'eur', color: 'url(javascript:alert(1))', size: 'Z' });
  assert.equal(d.currency, 'EUR');
  assert.equal(d.color, '#0f766e');
  assert.equal(d.size, 'A');
  assert.equal(sanitize(fields, { currency: 'NOPE' }).currency, 'USD');
});

test('sanitize caps rows and keeps the minimum', () => {
  const many = Array.from({ length: MAX_ROWS + 20 }, () => ({ a: 'x' }));
  assert.equal((sanitize(fields, { rows: many }).rows as unknown[]).length, MAX_ROWS);
  assert.equal((sanitize(fields, { rows: [] }).rows as unknown[]).length, 1);
  assert.equal((sanitize(fields, { items: [] }).items as unknown[]).length, 0);
});

test('sanitize is idempotent', () => {
  const once = sanitize(fields, { name: 'a', rows: [{ a: '1', n: '2' }], items: [{ t: 'z' }] });
  assert.deepEqual(sanitize(fields, once), once);
});

test('sanitize ignores non-object input', () => {
  assert.deepEqual(sanitize(fields, null), sanitize(fields, {}));
  assert.deepEqual(sanitize(fields, []), sanitize(fields, {}));
});

test('validateFields reports empty, bad numbers and bad dates with row context', () => {
  const d = defaultsOf(fields);
  d.name = '';
  d.when = '2026-02-31';
  (d.rows as { n: string }[])[0].n = 'ten';
  d.items = [{ t: '' }];
  const messages = validateFields(fields, d).map((p) => p.message);
  assert.deepEqual(messages, [
    'Name is empty.',
    'When is not a valid date.',
    'Line 1: N is not a number.',
    'Item 1: T is empty.',
  ]);
});

test('an invalid currency is fatal', () => {
  const d = defaultsOf(fields);
  d.currency = 'EU';
  assert.equal(
    validateFields(fields, d)
      .find((p) => p.fatal)
      ?.message.startsWith('Currency'),
    true,
  );
});

test('sheet fields keep columns, pad rows and fall back to the default', () => {
  const sheet: Field = {
    kind: 'sheet',
    key: 'sheet',
    label: 'Sheet',
    default: {
      columns: [{ label: 'A', align: 'left', format: 'text', width: 1, sum: false }],
      rows: [],
    },
  };
  const d = sanitize([sheet], {
    sheet: {
      columns: [
        { label: 'Qty', align: 'right', format: 'number', width: 99, sum: true },
        { label: 'Bad', align: 'nope', format: 'nope' },
      ],
      rows: [['1'], 'not a row', ['2', 'x', 'extra']],
    },
  });
  assert.deepEqual(d.sheet, {
    columns: [
      { label: 'Qty', align: 'right', format: 'number', width: 8, sum: true },
      { label: 'Bad', align: 'left', format: 'text', width: 1, sum: false },
    ],
    rows: [
      ['1', ''],
      ['2', 'x'],
    ],
  });
  assert.deepEqual(
    (sanitize([sheet], { sheet: { columns: [] } }).sheet as { columns: unknown[] }).columns.length,
    1,
  );
});
