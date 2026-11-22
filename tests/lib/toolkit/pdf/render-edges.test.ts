import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { renderPdf } from '../../../../src/lib/toolkit/pdf/render';
import type { Block, Layout } from '../../../../src/lib/toolkit/pdf/layout';

const layout = (blocks: Block[], extra: Partial<Layout> = {}): Layout => ({
  pageSize: 'Letter',
  accent: '#0f766e',
  title: 'T',
  author: '',
  footer: 'Page {page} of {pages}',
  blocks,
  ...extra,
});
const render = (blocks: Block[], extra: Partial<Layout> = {}) => renderPdf(layout(blocks, extra));
const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('text clean-up', () => {
  it('drops control characters silently and reports characters the font cannot draw', async () => {
    const { warnings } = await render([{ kind: 'text', text: 'a\u0001b\u007fc\td\u00a0e' }]);
    assert.deepEqual(warnings, []);
    const lossy = await render([{ kind: 'text', text: 'Привет' }]);
    assert.equal(lossy.warnings.length, 1);
  });
});

describe('wrapping', () => {
  it('keeps blank lines and breaks a first word that is wider than the column', async () => {
    const { bytes } = await render([{ kind: 'text', text: `first\n\n${'x'.repeat(400)}` }]);
    assert.equal(await pages(bytes), 1);
  });
});

describe('degenerate blocks', () => {
  it('skip columns, facts and tables that have nothing in them', async () => {
    const { bytes, warnings } = await render([
      { kind: 'columns', columns: [] },
      { kind: 'facts', items: [] },
      { kind: 'table', columns: [], rows: [['ignored']] },
    ]);
    assert.deepEqual(warnings, []);
    assert.equal(await pages(bytes), 1);
  });

  it('show a dash for an empty fact, and tolerate rows shorter than their table', async () => {
    const { bytes } = await render([
      {
        kind: 'facts',
        items: [
          ['Label', ''],
          ['Other', 'v'],
        ],
        heading: 'Facts',
      },
      {
        kind: 'table',
        columns: [{ label: 'A' }, { label: 'B', align: 'center' }],
        rows: [['only a']],
        footer: ['Total', 'x'],
      },
    ]);
    assert.equal(await pages(bytes), 1);
  });

  it('wrap a table cell whose first word is wider than the column', async () => {
    const { bytes } = await render([
      { kind: 'table', columns: [{ label: 'A' }], rows: [['y'.repeat(500)]] },
    ]);
    assert.equal(await pages(bytes), 1);
  });

  it('wrap a long run of ordinary words onto several lines', async () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const { bytes, warnings } = await render([{ kind: 'text', text: words }]);
    assert.deepEqual(warnings, []);
    assert.equal(await pages(bytes), 1);
  });

  it('draw a QR code beside text under a heading', async () => {
    const { bytes, warnings } = await render([
      {
        kind: 'text',
        heading: 'PAYMENT',
        text: 'Pay here',
        qr: { payload: 'https://pay.example/1', caption: 'Scan to pay' },
      },
    ]);
    assert.deepEqual(warnings, []);
    assert.equal(await pages(bytes), 1);
  });

  it('draw a QR code beside text that has no heading', async () => {
    const { bytes, warnings } = await render([
      { kind: 'text', text: 'Pay here', qr: { payload: 'https://pay.example/1' } },
    ]);
    assert.deepEqual(warnings, []);
    assert.equal(await pages(bytes), 1);
  });

  it('draw a totals block without a grand total, and text without a heading', async () => {
    const { bytes } = await render([
      { kind: 'totals', rows: [['Subtotal', '$1.00']] },
      { kind: 'text', text: 'no heading here' },
    ]);
    assert.equal(await pages(bytes), 1);
  });
});

describe('pagination edge', () => {
  it('moves a table’s footer to the next page when its rows leave no room for it', async () => {
    const make = (rows: number, footer: boolean) =>
      render([
        {
          kind: 'table',
          columns: [{ label: 'Row' }],
          rows: Array.from({ length: rows }, (_, i) => [`row ${i}`]),
          footer: footer ? ['Total'] : undefined,
        },
      ]);
    let found = 0;
    for (let rows = 1; rows <= 60 && !found; rows++) {
      const [without, withFooter] = await Promise.all([make(rows, false), make(rows, true)]);
      if ((await pages(withFooter.bytes)) > (await pages(without.bytes))) found = rows;
    }
    assert.ok(found > 0, 'some row count pushes only the footer onto a new page');
  });
});

describe('the page footer', () => {
  it('is shortened with "..." when it would run off the page', async () => {
    const { bytes } = await render([{ kind: 'text', text: 'x' }], {
      footer: `${'long footer '.repeat(60)} Page {page} of {pages}`,
    });
    assert.equal(await pages(bytes), 1);
  });
});
