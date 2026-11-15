import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDoc, parseDoc } from '../../../../src/lib/toolkit/pdf/engine';
import { docTypes, getType } from '../../../../src/lib/toolkit/pdf/types';
import { slug } from '../../../../src/lib/toolkit/pdf/types/common';
import type { TableBlock, TotalsBlock } from '../../../../src/lib/toolkit/pdf/layout';

const type = (id: string) => getType(id)!;

test('the registry has unique, URL-safe ids', () => {
  const ids = docTypes.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

for (const t of docTypes) {
  test(`${t.id}: defaults and the example produce a layout`, () => {
    for (const data of [newDoc(t), parseDoc(t, t.example)]) {
      const layout = t.layout(parseDoc(t, data));
      assert.ok(layout.blocks.length > 0);
      assert.match(layout.accent, /^#[0-9a-f]{6}$/i);
      assert.ok(t.filename(parseDoc(t, data)).length > 0);
    }
  });
}

test('invoice: totals follow the exact currency math', () => {
  const t = type('invoice');
  const data = parseDoc(t, {
    items: [
      { description: 'Design', quantity: '1.5', unitPrice: '80' },
      { description: 'Hosting', quantity: '1', unitPrice: '12.34' },
    ],
    taxRate: '8.875',
  });
  const live = t.live!(data);
  assert.equal(live.cells!['items.0.amount'], '$120.00');
  assert.equal(live.totals!.at(-1)!.value, '$144.09');
  const totals = t.layout(data).blocks.find((b) => b.kind === 'totals') as TotalsBlock;
  assert.equal(totals.grand![1], '$144.09');
});

test('every type names its files from data.filename', () => {
  const fallback: Record<string, string> = {
    invoice: 'invoice',
    'service-log': 'service-log',
    custom: 'document',
  };
  for (const t of docTypes) {
    assert.ok(JSON.stringify(t.fields).includes('"key":"filename"'), `${t.id} has no filename`);
    // A new document shows a default in the field, and that is the name it downloads as.
    const fresh = newDoc(t);
    assert.ok(String(fresh.filename).length > 0);
    assert.equal(t.filename(parseDoc(t, fresh)), slug(String(fresh.filename), 'x'));
    // Whatever the user types is used, made safe; cleared, the type's fallback.
    assert.equal(t.filename(parseDoc(t, { filename: 'A/B 1' })), 'A-B-1');
    assert.equal(t.filename(parseDoc(t, { filename: '' })), fallback[t.id]);
  }
});

test('file names ignore the invoice number, footer text and title', () => {
  const inv = type('invoice');
  assert.equal(inv.filename(parseDoc(inv, { number: 'INV-9', filename: 'March' })), 'March');
  const log = type('service-log');
  assert.equal(log.filename(parseDoc(log, { footerText: 'Family log', filename: 'Car' })), 'Car');
  const doc = type('custom');
  assert.equal(doc.filename(parseDoc(doc, { title: 'Trip plan', filename: 'Trip' })), 'Trip');
});

test('service log: one page break between records, and a table per record', () => {
  const t = type('service-log');
  const record = { title: 'Oil change', items: [{ item: '', details: 'Done', amount: '10' }] };
  const layout = t.layout(parseDoc(t, { records: [record, record, record] }));
  assert.equal(layout.blocks.filter((b) => b.kind === 'pageBreak').length, 2);
  const tables = layout.blocks.filter((b): b is TableBlock => b.kind === 'table');
  assert.equal(tables.length, 3);
  // An empty service item reuses the record title.
  assert.equal(tables[0].rows[0][1], 'Oil change');
});

test('service log: hiding amounts drops the column and the totals', () => {
  const t = type('service-log');
  const layout = t.layout(parseDoc(t, { showAmounts: 'no' }));
  const table = layout.blocks.find((b): b is TableBlock => b.kind === 'table')!;
  assert.equal(table.columns.length, 3);
  assert.equal(
    layout.blocks.some((b) => b.kind === 'totals'),
    false,
  );
});

test('service log: archive created date falls back to the service date', () => {
  const t = type('service-log');
  const layout = t.layout(
    parseDoc(t, { correspondent: 'Car', records: [{ title: 'x', date: '2026-01-02' }] }),
  );
  const columns = layout.blocks.find((b) => b.kind === 'columns');
  assert.ok(columns && JSON.stringify(columns).includes('Created Date: 2026-01-02'));
});

test('custom: column formats, alignment and totals come from the sheet', () => {
  const t = type('custom');
  const data = parseDoc(t, {
    title: 'List',
    table: {
      columns: [
        { label: 'Item', align: 'left', format: 'text', width: 3, sum: false },
        { label: 'Qty', align: 'right', format: 'number', width: 1, sum: true },
        { label: 'Cost', align: 'right', format: 'money', width: 2, sum: true },
      ],
      rows: [
        ['Tent', '1', '120'],
        ['', '', ''],
        ['Bags', '2', '85.5'],
      ],
    },
  });
  const table = t.layout(data).blocks.find((b): b is TableBlock => b.kind === 'table')!;
  assert.deepEqual(table.rows, [
    ['Tent', '1', '$120.00'],
    ['Bags', '2', '$85.50'],
  ]); // blank row skipped
  assert.deepEqual(table.footer, ['Total', '3', '$205.50']);
  assert.deepEqual(
    table.columns.map((c) => [c.align, c.weight]),
    [
      ['left', 3],
      ['right', 1],
      ['right', 2],
    ],
  );
});

test('custom: details go beside the title or in a grid', () => {
  const t = type('custom');
  const details = [
    { label: 'By', value: 'Alex' },
    { label: '', value: '' },
  ];
  const grid = t.layout(parseDoc(t, { details, detailsStyle: 'grid' })).blocks;
  assert.ok(grid.some((b) => b.kind === 'facts'));
  const header = t.layout(parseDoc(t, { details, detailsStyle: 'header' })).blocks;
  assert.equal(
    header.some((b) => b.kind === 'facts'),
    false,
  );
  assert.deepEqual((header[0] as { meta: unknown }).meta, [['By', 'Alex']]);
});
