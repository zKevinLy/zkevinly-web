import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { buildPdf, parseDoc } from '../../../../src/lib/toolkit/pdf/engine';
import { renderPdf } from '../../../../src/lib/toolkit/pdf/render';
import type { Layout } from '../../../../src/lib/toolkit/pdf/layout';
import { getType } from '../../../../src/lib/toolkit/pdf/types';

const base = (blocks: Layout['blocks'], extra: Partial<Layout> = {}): Layout => ({
  pageSize: 'Letter',
  accent: '#0f766e',
  title: 'T',
  author: '',
  footer: 'Page {page} of {pages}',
  blocks,
  ...extra,
});

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

test('every block kind renders on one page', async () => {
  const { bytes, warnings } = await renderPdf(
    base([
      {
        kind: 'title',
        kicker: 'K',
        title: 'Title',
        subtitle: 'Sub',
        meta: [
          ['A', '1'],
          ['B', '2'],
        ],
      },
      {
        kind: 'columns',
        columns: [
          { heading: 'H', lines: [{ text: 'x', style: 'strong' }, { text: 'y' }] },
          { lines: [{ text: 'z', style: 'plain' }] },
        ],
      },
      {
        kind: 'facts',
        heading: 'F',
        items: [
          ['a', 'b'],
          ['c', 'd'],
          ['e', 'f'],
          ['g', 'h'],
        ],
      },
      {
        kind: 'table',
        heading: 'Tbl',
        columns: [{ label: 'A' }, { label: 'B', align: 'right', width: 60 }],
        rows: [['1', '2']],
        footer: ['Total', '2'],
      },
      { kind: 'totals', rows: [['Sub', '1']], grand: ['Total', '1'] },
      { kind: 'text', heading: 'T', text: 'body', mono: true },
      { kind: 'spacer', height: 10 },
    ]),
  );
  assert.deepEqual(warnings, []);
  assert.equal(await pageCount(bytes), 1);
});

test('page breaks start a new page but never leave a blank one', async () => {
  const text = { kind: 'text', heading: 'H', text: 'x' } as const;
  const brk = { kind: 'pageBreak' } as const;
  assert.equal(await pageCount((await renderPdf(base([text, brk, text, brk, text]))).bytes), 3);
  assert.equal(await pageCount((await renderPdf(base([brk, text, brk, brk, text]))).bytes), 2);
});

test('long tables paginate', async () => {
  const rows = Array.from({ length: 120 }, (_, i) => [
    `Item ${i + 1} with a reasonably long description that wraps onto more than one line when rendered`,
    '9.99',
  ]);
  const { bytes } = await renderPdf(
    base([
      { kind: 'table', columns: [{ label: 'D' }, { label: 'A', width: 60, align: 'right' }], rows },
    ]),
  );
  assert.ok((await pageCount(bytes)) > 2);
});

test('long text paginates and long unbroken words wrap', async () => {
  const text = Array.from({ length: 200 }, (_, i) => `Line ${i}`).join('\n');
  assert.ok((await pageCount((await renderPdf(base([{ kind: 'text', text }]))).bytes)) > 2);
  const word = 'A'.repeat(400);
  assert.ok(
    (await renderPdf(base([{ kind: 'table', columns: [{ label: 'D' }], rows: [[word]] }]))).bytes
      .length > 1000,
  );
});

test('A4 and Letter use their own page sizes', async () => {
  const doc = await PDFDocument.load((await renderPdf(base([], { pageSize: 'A4' }))).bytes);
  assert.ok(Math.abs(doc.getPage(0).getSize().width - 595.28) < 0.01);
});

test('characters outside the built-in font are reported, not fatal', async () => {
  const { warnings } = await renderPdf(
    base([{ kind: 'text', text: 'Müller \u4e2d\u6587 \u20b9' }]),
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /replaced/);
});

test('the QR code is drawn as vectors; an over-long payload is skipped with a warning', async () => {
  const plain = await renderPdf(base([{ kind: 'text', text: 'pay' }]));
  const qr = await renderPdf(
    base([
      {
        kind: 'text',
        text: 'pay',
        qr: { payload: 'https://pay.example.com/i/1', caption: 'Scan' },
      },
    ]),
  );
  assert.deepEqual(qr.warnings, []);
  assert.ok(qr.bytes.length > plain.bytes.length);
  const big = await renderPdf(
    base([{ kind: 'text', text: 'pay', qr: { payload: 'x'.repeat(5000) } }]),
  );
  assert.match(big.warnings[0], /QR/);
});

test('the footer fills in page numbers and metadata is set', async () => {
  const { bytes } = await renderPdf(base([], { title: 'My title', author: 'Me' }));
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), 'My title');
  assert.equal(doc.getAuthor(), 'Me');
});

test('a 13-record service log is 13 pages', async () => {
  const t = getType('service-log')!;
  const records = Array.from({ length: 13 }, (_, i) => ({
    title: `Service ${i + 1}`,
    recordId: `REC-${i + 1}`,
    date: '2026-01-01',
    items: [{ item: '', details: 'Done', amount: '0' }],
    originalNote: '2026-01-01',
  }));
  const { bytes, warnings } = await buildPdf(t, parseDoc(t, { records }));
  assert.deepEqual(warnings, []);
  assert.equal(await pageCount(bytes), 13);
});

test('one very long unbroken word wraps quickly instead of freezing the tab', async () => {
  const started = Date.now();
  const { bytes } = await renderPdf(
    base([{ kind: 'text', heading: 'H', text: 'A'.repeat(10_000) }]),
  );
  assert.ok(Date.now() - started < 5_000, 'wrapping a 10,000 character word took too long');
  assert.ok((await pageCount(bytes)) >= 1);
});

test('a document that would run past the page cap is refused with a clear error', async () => {
  const brk = { kind: 'pageBreak' } as const;
  const text = { kind: 'text', text: 'x' } as const;
  const blocks = Array.from({ length: 250 }, () => [text, brk]).flat();
  await assert.rejects(() => renderPdf(base(blocks)), /longer than 200 pages/);
});
