import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { extractPdf, parseEnvelope, validateDoc } from '../../../../src/lib/toolkit/pdf/engine';
import { MAX_ATTACHMENT_BYTES } from '../../../../src/lib/toolkit/pdf/embedded';
import { DocError } from '../../../../src/lib/toolkit/pdf/errors';
import { isValidCurrency, safeLocale } from '../../../../src/lib/toolkit/pdf/format';
import { minorDigits } from '../../../../src/lib/toolkit/pdf/money';
import {
  defaultsOf,
  sanitize,
  validateFields,
  type Field,
} from '../../../../src/lib/toolkit/pdf/schema';
import { date, money, number, pageFields } from '../../../../src/lib/toolkit/pdf/types/common';
import { custom } from '../../../../src/lib/toolkit/pdf/types/custom';
import { invoice } from '../../../../src/lib/toolkit/pdf/types/invoice';
import { serviceLog } from '../../../../src/lib/toolkit/pdf/types/service-log';
import type { Block, Layout } from '../../../../src/lib/toolkit/pdf/layout';

afterEach(() => mock.restoreAll());

const blocksOf = (layout: Layout, kind: Block['kind']) =>
  layout.blocks.filter((b) => b.kind === kind);
const totalsLabels = (layout: Layout) =>
  (blocksOf(layout, 'totals')[0] as Extract<Block, { kind: 'totals' }>).rows.map(
    ([label]) => label,
  );

describe('when the platform refuses a value', () => {
  it('a currency the engine rejects is not valid', () => {
    mock.method(Intl, 'NumberFormat', () => {
      throw new RangeError('Invalid currency code');
    });
    assert.equal(isValidCurrency('USD'), false);
  });
  it('minor digits fall back to 2 when the engine cannot say', () => {
    mock.method(Intl, 'NumberFormat', function () {
      throw new RangeError('no');
    });
    assert.equal(minorDigits('USD'), 2);
    mock.restoreAll();
    mock.method(Intl, 'NumberFormat', function () {
      return { resolvedOptions: () => ({}) };
    });
    assert.equal(minorDigits('USD'), 2);
  });
  it('safeLocale canonicalises, and falls back for anything malformed', () => {
    assert.equal(safeLocale('EN-gb'), 'en-GB');
    assert.equal(safeLocale('not a locale!'), 'en-US');
    assert.equal(safeLocale(''), 'en-US');
  });
});

describe('sanitizing odd input', () => {
  it('an empty locale takes the default', () => {
    const fields: Field[] = [{ kind: 'locale', key: 'loc', label: 'L', default: 'en-GB' }];
    assert.equal(sanitize(fields, { loc: '   ' }).loc, 'en-GB');
    assert.equal(sanitize(fields, { loc: 'fr-FR' }).loc, 'fr-FR');
  });

  it('sheet widths are whole numbers between 1 and 8, whatever was sent; rows must be a list', () => {
    const fallback = {
      columns: [{ label: 'A', align: 'left', format: 'text', width: 1, sum: false }],
      rows: [],
    } as const;
    const fields: Field[] = [
      { kind: 'sheet', key: 's', label: 'S', default: JSON.parse(JSON.stringify(fallback)) },
    ];
    const out = sanitize(fields, {
      s: {
        columns: [
          { width: Number.NaN },
          { width: Infinity },
          { width: 99 },
          { width: 2.4 },
          { width: 'wide' },
        ],
        rows: 'nope',
      },
    }).s as { columns: { width: number }[]; rows: string[][] };
    assert.deepEqual(
      out.columns.map((c) => c.width),
      [1, 1, 8, 2, 1],
    );
    assert.deepEqual(out.rows, []);
  });
});

describe('validating', () => {
  const table = (over: Record<string, unknown> = {}): Field =>
    ({
      kind: 'table',
      key: 't',
      label: 'T',
      columns: [{ key: 'q', label: 'Qty', type: 'decimal' }],
      ...over,
    }) as Field;
  const messages = (fields: Field[], data: Record<string, unknown>) =>
    validateFields(fields, data).map((p) => p.message);

  it('table: required numbers, bad numbers, row labels, and data that is not a list', () => {
    const required = table({
      rowLabel: 'Line',
      columns: [{ key: 'q', label: 'Qty', type: 'decimal', required: true }],
    });
    assert.deepEqual(messages([required], { t: [{ q: '' }] }), ['Line 1: Qty is not a number.']);
    assert.deepEqual(messages([table()], { t: [{ q: '' }] }), []);
    assert.deepEqual(messages([table()], { t: [{ q: 'x' }] }), ['Row 1: Qty is not a number.']);
    assert.deepEqual(messages([table()], { t: [{ q: '4.5' }, 'junk'] }), []);
    assert.deepEqual(messages([table()], { t: 'not a list' }), []);
  });

  it('a decimal field must be a number, and a required one must not be empty', () => {
    const decimal = (required = false): Field => ({
      kind: 'decimal',
      key: 'd',
      label: 'Rate',
      required,
    });
    assert.deepEqual(messages([decimal()], { d: 'abc' }), ['Rate is not a number.']);
    assert.deepEqual(messages([decimal(true)], { d: '' }), ['Rate is empty.']);
    assert.deepEqual(messages([decimal()], { d: '' }), []);
  });

  it('list: checks every item with its own prefix, and ignores a list that is not one', () => {
    const list: Field = {
      kind: 'list',
      key: 'l',
      label: 'L',
      itemLabel: 'Item',
      fields: [{ kind: 'decimal', key: 'd', label: 'Rate' }],
    };
    assert.deepEqual(messages([list], { l: [{ d: '1' }, { d: 'x' }] }), [
      'Item 2: Rate is not a number.',
    ]);
    assert.deepEqual(messages([list], { l: 'no' }), []);
  });

  it('sheet: dates and numbers in their columns, and nothing for text or empty cells', () => {
    const sheet: Field = {
      kind: 'sheet',
      key: 's',
      label: 'S',
      default: { columns: [], rows: [] },
    };
    const columns = [
      { label: 'When', format: 'date' },
      { label: 'Qty', format: 'number' },
      { label: 'Cost', format: 'money' },
      { label: 'Note', format: 'text' },
      { label: 7, format: 'date' },
    ];
    assert.deepEqual(
      messages([sheet], {
        s: {
          columns,
          rows: [
            ['2026-13-45', 'x', 'y', 'anything', 'bad'],
            ['2026-01-31', '3', '4.5', 'fine', '2026-02-02'],
            ['', '  ', '', '', ''],
            'not a row',
          ],
        },
      }),
      [
        'Row 1: "When" is not a valid date (YYYY-MM-DD).',
        'Row 1: "Qty" is not a number.',
        'Row 1: "Cost" is not a number.',
        'Row 1: "" is not a valid date (YYYY-MM-DD).',
      ],
    );
    assert.deepEqual(messages([sheet], { s: 5 }), []);
    assert.deepEqual(messages([sheet], { s: { columns: 'x', rows: [] } }), []);
    assert.deepEqual(messages([sheet], { s: { columns: [], rows: 'x' } }), []);
  });

  it('a document type can add its own checks on top', () => {
    const extra = { ...custom, validate: () => [{ message: 'Type-level problem.' }] };
    assert.ok(
      validateDoc(extra as never, defaultsOf(custom.fields)).some(
        (p) => p.message === 'Type-level problem.',
      ),
    );
    assert.ok(
      Array.isArray(
        validateDoc({ ...custom, validate: undefined } as never, defaultsOf(custom.fields)),
      ),
    );
  });
});

describe('envelopes', () => {
  it('rejects a type that is not even text', () => {
    assert.throws(
      () => parseEnvelope({ schema: 'toolkit.pdf', version: 1, type: 5, data: {} }),
      /does not have \(5\)/,
    );
  });
  it('still opens files from the old invoice tool, and says when one is too new', () => {
    const legacy = { schema: 'toolkit.invoice', version: 1, notes: 'old' };
    assert.throws(() => parseEnvelope({ ...legacy, version: 99 }), DocError);
    assert.throws(() => parseEnvelope({ ...legacy, version: 'one' }), DocError);
    const opened = parseEnvelope(legacy);
    assert.equal(opened.type.id, 'invoice');
    assert.equal((opened.data as { notes: string }).notes, 'old');
  });
});

describe('shared display helpers', () => {
  it('drop the currency field when asked', () => {
    const keys = (fields: Field[]) => fields.map((f) => ('key' in f ? f.key : ''));
    assert.ok(keys(pageFields('#112233')).includes('currency'));
    assert.ok(!keys(pageFields('#112233', false)).includes('currency'));
  });
  it('show nothing for blank values, and what was typed when it is not a number', () => {
    assert.equal(money('  ', 'USD', 'en-US'), '');
    assert.equal(money('abc', 'USD', 'en-US'), 'abc');
    assert.equal(money('12.5', 'USD', 'en-US'), '$12.50');
    assert.equal(number('', 'en-US'), '');
    assert.equal(number('abc', 'en-US'), 'abc');
    assert.equal(number('1234.5', 'en-US'), '1,234.5');
    assert.equal(date('2026-03-04', 'en-US').length > 0, true);
  });
});

describe('invoice layout and live totals', () => {
  const base = () => defaultsOf(invoice.fields);
  const make = (over: Record<string, unknown>) => ({
    ...base(),
    items: [{ description: 'Thing', quantity: '2', unitPrice: '50' }],
    ...over,
  });

  it('labels a percent discount with its rate, and a fixed one plainly', () => {
    const percent = invoice.layout(
      make({ discount: { type: 'percent', value: '10' }, taxRate: '8', taxLabel: '' }) as never,
    );
    assert.deepEqual(totalsLabels(percent), ['Subtotal', 'Discount (10%)', 'Tax (8%)']);
    const fixed = invoice.layout(
      make({ discount: { type: 'fixed', value: '5' }, taxRate: '8', taxLabel: 'VAT' }) as never,
    );
    assert.deepEqual(totalsLabels(fixed), ['Subtotal', 'Discount', 'VAT (8%)']);
  });

  it('shows only the subtotal with no discount and no tax', () => {
    const plain = invoice.layout(
      make({ discount: { type: 'percent', value: '0' }, taxRate: '0' }) as never,
    );
    assert.deepEqual(totalsLabels(plain), ['Subtotal']);
  });

  it('adds a payment section for instructions, a QR code, both, or neither', () => {
    const payment = (p: Record<string, string>) =>
      blocksOf(
        invoice.layout(
          make({ payment: { instructions: '', qrPayload: '', qrLabel: 'Scan', ...p } }) as never,
        ),
        'text',
      ).filter((b) => (b as { heading?: string }).heading === 'PAYMENT') as {
        text: string;
        qr?: { payload: string };
      }[];
    assert.equal(payment({}).length, 0);
    assert.equal(payment({ instructions: 'Bank X' })[0].qr, undefined);
    assert.equal(
      payment({ qrPayload: 'https://pay.example/1' })[0].qr?.payload,
      'https://pay.example/1',
    );
    assert.equal(payment({ instructions: 'Bank X', qrPayload: 'p' })[0].text, 'Bank X');
  });

  it('shows a tax ID only when there is one, and a due date only when set', () => {
    const withIds = invoice.layout(
      make({
        from: { name: 'A', address: '', email: '', taxId: 'T-1' },
        to: { name: 'B', address: '', email: '', taxId: '' },
        dueDate: '2026-12-01',
      }) as never,
    );
    const columns = (blocksOf(withIds, 'columns')[0] as Extract<Block, { kind: 'columns' }>)
      .columns;
    assert.equal(columns[0].lines[3].text, 'Tax ID: T-1');
    assert.equal(columns[1].lines[3].text, '');
    assert.ok(
      (blocksOf(withIds, 'title')[0] as Extract<Block, { kind: 'title' }>).meta!.some(
        ([label]) => label === 'Due',
      ),
    );
    const without = invoice.layout(make({ dueDate: '' }) as never);
    assert.ok(
      !(blocksOf(without, 'title')[0] as Extract<Block, { kind: 'title' }>).meta!.some(
        ([label]) => label === 'Due',
      ),
    );
  });

  it('shows live totals in USD while the currency box holds something invalid', () => {
    const live = invoice.live!(make({ currency: 'nope' }) as never);
    assert.match(live.totals![0].value, /\$/);
  });

  it('live totals show a discount as a deduction, and plain zero otherwise', () => {
    const withDiscount = invoice.live!(make({ discount: { type: 'fixed', value: '5' } }) as never);
    assert.match(withDiscount.totals!.find((t) => t.label === 'Discount')!.value, /^-/);
    const none = invoice.live!(make({ discount: { type: 'fixed', value: '0' } }) as never);
    assert.doesNotMatch(none.totals!.find((t) => t.label === 'Discount')!.value, /^-/);
    assert.equal(withDiscount.totals!.at(-1)!.strong, true);
  });

  it('live totals fall back to the raw amount if the platform cannot format money', () => {
    mock.method(Intl, 'NumberFormat', function () {
      throw new RangeError('no formatter');
    });
    const live = invoice.live!(make({}) as never);
    assert.equal(live.cells!['items.0.amount'], '100.00');
    assert.equal(live.totals![0].value, '100.00');
  });
});

describe('custom document layout', () => {
  const sheet = (columns: object[], rows: string[][]) => ({ columns, rows });
  const col = (over: Record<string, unknown>) => ({
    label: 'C',
    align: 'left',
    format: 'text',
    width: 1,
    sum: false,
    ...over,
  });
  const make = (over: Record<string, unknown>) => ({ ...defaultsOf(custom.fields), ...over });
  const table = (layout: Layout) =>
    blocksOf(layout, 'table')[0] as Extract<Block, { kind: 'table' }>;

  it('formats cells by column kind and totals money and number columns', () => {
    const layout = custom.layout(
      make({
        table: sheet(
          [
            col({ label: 'Item' }),
            col({ label: 'Note' }),
            col({ label: 'Qty', format: 'number', sum: true }),
            col({ label: 'Cost', format: 'money', sum: true }),
            col({ label: 'On', format: 'date' }),
          ],
          [
            ['Pen', 'x', '2', '1.5', '2026-03-04'],
            ['Ink', 'y', '3', '4', '2026-04-05'],
          ],
        ),
        currency: 'USD',
      }) as never,
    );
    const t = table(layout);
    assert.deepEqual(t.footer!.slice(0, 2), ['Total', '']);
    assert.equal(t.footer![2], '5');
    assert.equal(t.footer![3], '$5.50');
    assert.equal(t.rows[0][3], '$1.50');
    assert.ok(t.rows[0][4].length > 0 && t.rows[0][4] !== '2026-03-04');
  });

  it('copes with rows shorter than the columns, and skips blank rows', () => {
    const layout = custom.layout(
      make({
        table: sheet(
          [col({}), col({ format: 'number', sum: true })],
          [['only one cell'], ['', ''], ['a', '3']],
        ),
      }) as never,
    );
    const t = table(layout);
    assert.equal(t.rows.length, 2);
    assert.deepEqual(t.rows[0], ['only one cell', '']);
    assert.equal(t.footer![1], '3');
  });

  it('has no total row when no column is totalled, and no table when every row is empty', () => {
    const noSum = custom.layout(make({ table: sheet([col({})], [['a']]) }) as never);
    assert.equal(table(noSum).footer, undefined);
    const empty = custom.layout(make({ table: sheet([col({})], [['']]) }) as never);
    assert.equal(blocksOf(empty, 'table').length, 0);
  });

  it('titles an untitled document, and puts custom footer text before the page number', () => {
    const untitled = custom.layout(make({ title: '  ', footerText: '' }) as never);
    assert.equal(untitled.title, 'Untitled document');
    assert.equal(untitled.footer, 'Page {page} of {pages}');
    const named = custom.layout(make({ title: 'Report', footerText: 'Acme' }) as never);
    assert.equal(named.title, 'Report');
    assert.equal(named.footer, 'Acme  -  Page {page} of {pages}');
  });
});

describe('service log footer', () => {
  it('uses the footer text as the title, or "Service log"', () => {
    const base = defaultsOf(serviceLog.fields);
    assert.equal(serviceLog.layout({ ...base, footerText: '' } as never).title, 'Service log');
    const named = serviceLog.layout({ ...base, footerText: 'Garage' } as never);
    assert.equal(named.title, 'Garage');
    assert.equal(named.footer, 'Garage \u2022 Page {page} of {pages}');
  });
});

describe('reading attachments written by other tools', () => {
  const config = () =>
    JSON.stringify({ schema: 'toolkit.pdf', version: 1, type: 'invoice', data: { notes: 'hi' } });
  type Patch = (stream: PDFRawStream, doc: PDFDocument) => void;

  async function pdfWith(patch: Patch, body = config()) {
    const doc = await PDFDocument.create();
    doc.addPage();
    await doc.attach(new TextEncoder().encode(body), 'pdf-config.json', {
      mimeType: 'application/json',
    });
    await doc.flush(); // attach() only queues the file; flush() writes it into the document
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (object instanceof PDFRawStream && object.dict.has(PDFName.of('Filter')))
        patch(object, doc);
    }
    return doc.save();
  }
  const stored =
    (body: string): Patch =>
    (stream) => {
      (stream as unknown as { contents: Uint8Array }).contents = new TextEncoder().encode(body);
      stream.dict.delete(PDFName.of('Filter'));
    };

  it('reads an uncompressed attachment', async () => {
    assert.equal((await extractPdf(await pdfWith(stored(config())))).type.id, 'invoice');
  });
  it('refuses an uncompressed attachment over the limit', async () => {
    const big = config() + ' '.repeat(MAX_ATTACHMENT_BYTES);
    await assert.rejects(extractPdf(await pdfWith(stored(big))), DocError);
  });
  it('reads a filter written as a one-item list', async () => {
    const pdf = await pdfWith((stream, doc) =>
      stream.dict.set(PDFName.of('Filter'), doc.context.obj([PDFName.of('FlateDecode')])),
    );
    assert.equal((await extractPdf(pdf)).type.id, 'invoice');
  });
  it('refuses chained filters and filters that are not names', async () => {
    const chained = await pdfWith((stream, doc) =>
      stream.dict.set(
        PDFName.of('Filter'),
        doc.context.obj([PDFName.of('ASCIIHexDecode'), PDFName.of('FlateDecode')]),
      ),
    );
    await assert.rejects(extractPdf(chained), DocError);
    const odd = await pdfWith((stream, doc) =>
      stream.dict.set(PDFName.of('Filter'), doc.context.obj(7)),
    );
    await assert.rejects(extractPdf(odd), DocError);
  });
});
