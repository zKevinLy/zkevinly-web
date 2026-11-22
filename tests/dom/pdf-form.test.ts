import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type Dom } from '../helpers/dom';
import { renderForm, type FormHandle } from '../../src/lib/toolkit/pdf/ui/form';
import { defaultsOf, type Data, type Field } from '../../src/lib/toolkit/pdf/schema';
import { invoice } from '../../src/lib/toolkit/pdf/types/invoice';
import { serviceLog } from '../../src/lib/toolkit/pdf/types/service-log';
import { custom } from '../../src/lib/toolkit/pdf/types/custom';

const SHEET = {
  columns: [
    { label: 'Item', align: 'left', format: 'text', width: 2, sum: false },
    { label: 'Price', align: 'right', format: 'money', width: 1, sum: true },
    { label: 'When', align: 'center', format: 'date', width: 1, sum: false },
    { label: 'Qty', align: 'right', format: 'number', width: 1, sum: false },
  ],
  rows: [
    ['Pen', '1.50', '2026-01-01', '3'],
    ['Ink', '4', '2026-01-02', '1'],
  ],
} as const;

const FIELDS: Field[] = [
  {
    kind: 'group',
    fields: [
      {
        kind: 'text',
        key: 'name',
        label: 'Name',
        placeholder: 'Your name',
        maxLength: 20,
        help: 'Shown on top.',
      },
    ],
  },
  {
    kind: 'group',
    key: 'billing',
    label: 'Billing',
    half: true,
    stack: true,
    fields: [
      { kind: 'email', key: 'email', label: 'Email' },
      { kind: 'color', key: 'accent', label: 'Accent', default: '#336699' },
      { kind: 'decimal', key: 'rate', label: 'Rate' },
      { kind: 'currency', key: 'ccy', label: 'Currency', suggestions: ['USD', 'EUR'] },
      { kind: 'locale', key: 'loc', label: 'Locale' },
      { kind: 'date', key: 'due', label: 'Due' },
    ],
  },
  {
    kind: 'group',
    label: 'Plain group',
    fields: [{ kind: 'textarea', key: 'notes', label: 'Notes', rows: 6 }],
  },
  { kind: 'group', key: 'extra', fields: [{ kind: 'textarea', key: 'more', label: 'More' }] },
  {
    kind: 'select',
    key: 'size',
    label: 'Size',
    options: [
      { value: 'a4', label: 'A4' },
      { value: 'letter', label: 'Letter' },
    ],
    default: 'a4',
  },
  {
    kind: 'table',
    key: 'items',
    label: 'Items',
    help: 'What you sold.',
    rowLabel: 'Line',
    addLabel: 'Add a line',
    columns: [
      { key: 'desc', label: 'Description', type: 'text' },
      { key: 'detail', label: 'Detail', type: 'textarea' },
      { key: 'qty', label: 'Qty', type: 'decimal', default: '1' },
      { key: 'amount', label: 'Amount', type: 'computed' },
    ],
  },
  {
    kind: 'table',
    key: 'plain',
    label: 'Plain table',
    minRows: 2,
    columns: [{ key: 'v', label: 'Value', type: 'text', width: '9rem' }],
  },
  {
    kind: 'list',
    key: 'records',
    label: 'Records',
    help: 'One per visit.',
    itemLabel: 'Record',
    titleKey: 'title',
    fields: [{ kind: 'text', key: 'title', label: 'Title' }],
  },
  {
    kind: 'list',
    key: 'tags',
    label: 'Tags',
    itemLabel: 'Tag',
    min: 0,
    addLabel: 'More tags',
    fields: [{ kind: 'text', key: 'tag', label: 'Tag' }],
  },
  { kind: 'sheet', key: 'sheet', label: 'Sheet', default: JSON.parse(JSON.stringify(SHEET)) },
  { kind: 'summary', label: 'Totals' },
  { kind: 'summary', label: 'Half totals', half: true },
];

let dom: Dom;
let host: HTMLElement;
let data: Data;
let changes: number;
let form: FormHandle;

const $ = <T extends Element = HTMLElement>(sel: string, from: ParentNode = host) =>
  from.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, from: ParentNode = host) => [
  ...from.querySelectorAll<T>(sel),
];
const group = (legend: string) =>
  $$('fieldset').find((f) => f.querySelector('legend')?.textContent === legend)!;
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const click = (el: Element) =>
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const labelled = (label: string, from: ParentNode = host) =>
  $$<HTMLElement>('[aria-label]', from).find((el) => el.getAttribute('aria-label') === label)!;

beforeEach(() => {
  dom = installDom();
  host = dom.document.createElement('div');
  dom.document.body.append(host);
  data = defaultsOf(FIELDS);
  changes = 0;
  form = renderForm(host, FIELDS, data, () => changes++);
});
afterEach(() => dom.restore());

describe('scalar fields', () => {
  it('write what is typed into the data and report the change', () => {
    const name = $<HTMLInputElement>('input[placeholder="Your name"]');
    assert.equal(name.maxLength, 20);
    type(name, 'Ada');
    assert.equal(data.name, 'Ada');
    assert.equal(changes, 1);
    type($<HTMLTextAreaElement>('textarea[rows="6"]'), 'hello');
    assert.equal(data.notes, 'hello');
  });

  it('picks the right input type, mode and spellcheck for each kind', () => {
    const billing = group('Billing');
    assert.equal($<HTMLInputElement>('input[type=email]', billing).value, '');
    assert.equal($<HTMLInputElement>('input[type=color]', billing).value, '#336699');
    assert.equal(
      $('input[inputmode=decimal]', billing).closest('label')!.textContent!.startsWith('Rate'),
      true,
    );
    assert.equal(
      $('input[spellcheck=false]', billing).closest('label')!.textContent!.includes('Currency'),
      true,
    );
    assert.equal($$('input[spellcheck=false]', billing).length, 2);
    assert.equal(
      $('input[type=date]', billing).closest('label')!.textContent!.includes('Due'),
      true,
    );
    assert.ok($('label.field-color', billing));
    assert.ok(billing.classList.contains('half'));
    assert.ok($('.fields-one', billing));
  });

  it('offers suggestions through a datalist with its own id', () => {
    const input = $<HTMLInputElement>('input[list]');
    const list = dom.document.getElementById(input.getAttribute('list')!)!;
    assert.deepEqual(
      $$('option', list).map((o) => o.getAttribute('value')),
      ['USD', 'EUR'],
    );
  });

  it('shows help text only when there is some', () => {
    assert.equal(
      $$('p.help').some((p) => p.textContent === 'Shown on top.'),
      true,
    );
    assert.equal($('input[type=email]').closest('label')!.querySelector('.help'), null);
  });

  it('writes into a nested group’s own object, and a label-less group adds no box', () => {
    type($<HTMLInputElement>('input[type=email]'), 'a@b.c');
    assert.equal((data.billing as Data).email, 'a@b.c');
    type(
      $$<HTMLTextAreaElement>('textarea').find((t) =>
        t.closest('label')!.textContent!.startsWith('More'),
      )!,
      'x',
    );
    assert.equal((data.extra as Data).more, 'x');
    assert.ok($('.contents'));
    assert.equal(group('Plain group').tagName, 'FIELDSET');
    assert.equal($('textarea[rows="3"]').closest('label')!.textContent!.startsWith('More'), true);
  });

  it('selects write the chosen value', () => {
    const select = $<HTMLSelectElement>('select');
    assert.equal(select.value, 'a4');
    assert.equal(select.hasAttribute('aria-label'), false);
    select.value = 'letter';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(data.size, 'letter');
    assert.equal(changes, 1);
  });
});

describe('table', () => {
  const rows = () => $$('.row', group('Items'));
  const items = () => data.items as Data[];

  it('draws one row per entry with the right inputs and a computed cell', () => {
    assert.equal(rows().length, 1);
    assert.equal($$('input,textarea', rows()[0]).length, 3);
    assert.ok($('textarea', rows()[0]));
    assert.equal($<HTMLInputElement>('input[inputmode=decimal]', rows()[0]).value, '1');
    assert.ok($('output.row-amount', rows()[0]));
    assert.ok($('.rows-head .num', group('Items')));
    assert.equal(
      rows()[0].style.getPropertyValue('--cols'),
      'minmax(0, 1fr) minmax(0, 1fr) 6.5rem 6.5rem 2rem',
    );
  });

  it('typing updates the row; the computed cell comes from setLive', () => {
    type($('input', rows()[0]) as HTMLInputElement, 'Widget');
    assert.equal(items()[0].desc, 'Widget');
    form.setLive({ cells: { 'items.0.amount': '$5.00' } });
    assert.equal($('output', rows()[0]).textContent, '$5.00');
    form.setLive({});
    assert.equal($('output', rows()[0]).textContent, '');
  });

  it('adds a row, reports it and focuses the new row', () => {
    click($('.btn', group('Items')));
    assert.equal(items().length, 2);
    assert.equal(rows().length, 2);
    assert.equal(changes, 1);
    assert.equal(dom.document.activeElement, $('input', rows()[1]));
    assert.equal($('.btn', group('Items')).textContent, 'Add a line');
  });

  it('removes a row, but never below the minimum', () => {
    click($('.btn', group('Items')));
    click($('.row-remove', rows()[0]));
    assert.equal(items().length, 1);
    click($('.row-remove', rows()[0]));
    assert.equal(items().length, 1);
    assert.equal(items()[0].qty, '1');
    assert.equal($('.row-remove', rows()[0]).getAttribute('aria-label'), 'Remove line 1');
  });

  it('honours minRows, default labels and column widths', () => {
    const plain = group('Plain table');
    assert.equal($$('.row', plain).length, 2);
    assert.equal($('.btn', plain).textContent, 'Add row');
    assert.match($('.rows-head', plain).style.getPropertyValue('--cols'), /^9rem 2rem$/);
    assert.equal($('.help', group('Items')).textContent, 'What you sold.');
  });
});

describe('list of cards', () => {
  const cards = () => $$('.card', group('Records'));
  const records = () => data.records as Data[];
  const button = (card: Element, label: string) =>
    $$('button', card).find((b) => b.getAttribute('aria-label')?.startsWith(label))!;

  it('starts open for short lists, titled by the record', () => {
    assert.equal(cards().length, 1);
    assert.equal($('.card-toggle', cards()[0]).textContent, 'Record 1');
    assert.equal($('.card-toggle', cards()[0]).getAttribute('aria-expanded'), 'true');
    assert.equal($('.card-body', cards()[0]).hidden, false);
    type($('input', cards()[0]) as HTMLInputElement, 'Brakes');
    assert.equal($('.card-toggle', cards()[0]).textContent, 'Record 1: Brakes');
  });

  it('collapses and expands a card, and remembers it across redraws', () => {
    const toggle = $('.card-toggle', cards()[0]);
    click(toggle);
    assert.equal($('.card-body', cards()[0]).hidden, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    click(button(cards()[0], 'Duplicate'));
    assert.equal($('.card-body', cards()[0]).hidden, true, 'the collapsed card stays collapsed');
    assert.equal($('.card-body', cards()[1]).hidden, false, 'the copy opens');
  });

  it('moves, duplicates and removes records', () => {
    click($('.btn', group('Records')));
    assert.equal(records().length, 2);
    type($('input', cards()[0]) as HTMLInputElement, 'first');
    type($('input', cards()[1]) as HTMLInputElement, 'second');
    assert.equal((button(cards()[0], 'Move') as HTMLButtonElement).disabled, true);
    assert.equal((button(cards()[1], 'Move record 2 down') as HTMLButtonElement).disabled, true);
    click(button(cards()[0], 'Move record 1 down'));
    assert.deepEqual(
      records().map((r) => r.title),
      ['second', 'first'],
    );
    click(button(cards()[1], 'Move record 2 up'));
    assert.deepEqual(
      records().map((r) => r.title),
      ['first', 'second'],
    );
    click(button(cards()[0], 'Duplicate'));
    assert.deepEqual(
      records().map((r) => r.title),
      ['first', 'first', 'second'],
    );
    assert.notEqual(records()[0], records()[1], 'the copy is independent');
    click(button(cards()[1], 'Remove'));
    assert.deepEqual(
      records().map((r) => r.title),
      ['first', 'second'],
    );
  });

  it('will not remove the last record, and can reach zero when allowed', () => {
    assert.equal((button(cards()[0], 'Remove') as HTMLButtonElement).disabled, true);
    const tags = group('Tags');
    assert.equal($$('.card', tags).length, 0);
    click($('.btn', tags));
    assert.equal($('.btn', tags).textContent, 'More tags');
    assert.equal((data.tags as Data[]).length, 1);
    click(button($('.card', tags), 'Remove'));
    assert.equal((data.tags as Data[]).length, 0);
  });

  it('adding focuses the new record, and long lists start collapsed', () => {
    for (let i = 0; i < 3; i++) click($('.btn', group('Records')));
    assert.equal(records().length, 4);
    assert.equal($('.card-body', cards()[0]).hidden, true, 'more than three: collapsed');
    assert.equal($('.card-body', cards()[3]).hidden, false, 'the one just added is open');
    assert.equal(dom.document.activeElement, $('input', cards()[3]));
  });

  it('shows the list help', () => {
    assert.equal($('.help', group('Records')).textContent, 'One per visit.');
  });
});

describe('sheet', () => {
  const sheet = () => data.sheet as { columns: Data[]; rows: string[][] };
  const colRows = () => $$('.col-row:not(.rows-head)', group('Sheet'));
  const bodyRows = () => $$('.rows:last-of-type .row', group('Sheet'));
  const head = () => $$('.rows-head', group('Sheet'))[1];

  it('draws a column editor and the rows beneath it', () => {
    assert.equal(colRows().length, 4);
    assert.equal(bodyRows().length, 2);
    assert.deepEqual(
      $$('span', head()).map((s) => s.textContent),
      ['Item', 'Price', 'When', 'Qty', ''],
    );
    assert.equal($$<HTMLInputElement>('input', bodyRows()[0])[2].placeholder, 'YYYY-MM-DD');
    assert.equal(
      $$<HTMLInputElement>('input', bodyRows()[0])[1].getAttribute('inputmode'),
      'decimal',
    );
    assert.equal(
      $$<HTMLInputElement>('input', bodyRows()[0])[3].getAttribute('inputmode'),
      'decimal',
    );
    assert.equal($$<HTMLInputElement>('input', bodyRows()[0])[1].style.textAlign, 'right');
  });

  it('renaming a column updates the headings and falls back to "Column N" when blank', () => {
    type(labelled('Column 1 name') as HTMLInputElement, 'Thing');
    assert.equal(sheet().columns[0].label, 'Thing');
    assert.equal($$('span', head())[0].textContent, 'Thing');
    type(labelled('Column 1 name') as HTMLInputElement, '');
    assert.equal($$('span', head())[0].textContent, 'Column 1');
  });

  it('changes alignment and format and redraws the rows', () => {
    const align = labelled('Column 1 alignment') as HTMLSelectElement;
    align.value = 'center';
    align.dispatchEvent(new dom.window.Event('change'));
    assert.equal(sheet().columns[0].align, 'center');
    assert.equal($$<HTMLInputElement>('input', bodyRows()[0])[0].style.textAlign, 'center');
    const format = labelled('Column 1 format') as HTMLSelectElement;
    format.value = 'date';
    format.dispatchEvent(new dom.window.Event('change'));
    assert.equal(sheet().columns[0].format, 'date');
    assert.equal($$<HTMLInputElement>('input', bodyRows()[0])[0].placeholder, 'YYYY-MM-DD');
  });

  it('clamps the width between 1 and 8', () => {
    const width = labelled('Column 1 width') as HTMLInputElement;
    for (const [typed, stored] of [
      ['5', 5],
      ['99', 8],
      ['0', 1],
      ['2.6', 3],
    ] as const) {
      type(width, typed);
      assert.equal(sheet().columns[0].width, stored, typed);
    }
    const text = labelled('Column 2 width') as HTMLInputElement;
    text.type = 'text'; // a number box never yields NaN; a text box can
    type(text, 'abc');
    assert.equal(sheet().columns[1].width, 1);
  });

  it('toggles whether a column is totalled', () => {
    const sum = labelled('Total column 1') as HTMLInputElement;
    sum.checked = true;
    sum.dispatchEvent(new dom.window.Event('change'));
    assert.equal(sheet().columns[0].sum, true);
  });

  it('edits and removes rows, adds rows with one empty cell per column', () => {
    type($$<HTMLInputElement>('input', bodyRows()[0])[0], 'Pencil');
    assert.equal(sheet().rows[0][0], 'Pencil');
    click($('.row-remove', bodyRows()[0]));
    assert.equal(sheet().rows.length, 1);
    click($$('.btn', group('Sheet')).find((b) => b.textContent === 'Add row')!);
    assert.deepEqual(sheet().rows[1], ['', '', '', '']);
    assert.equal(dom.document.activeElement, $$('input', bodyRows()[1])[0]);
  });

  it('adds columns (padding every row) up to 12, then stops', () => {
    const add = $$('.btn', group('Sheet')).find((b) => b.textContent === 'Add column')!;
    click(add);
    assert.equal(sheet().columns.length, 5);
    assert.ok(sheet().rows.every((row) => row.length === 5));
    assert.equal(dom.document.activeElement, $('input', colRows()[4]));
    for (let i = 0; i < 10; i++) click(add);
    assert.equal(sheet().columns.length, 12);
    const before = changes;
    click(add);
    assert.equal(changes, before);
  });

  it('removes a column and its cells; the last column cannot be removed', () => {
    click(labelled('Remove column 2'));
    assert.deepEqual(
      sheet().columns.map((c) => c.label),
      ['Item', 'When', 'Qty'],
    );
    assert.deepEqual(sheet().rows[0], ['Pen', '2026-01-01', '3']);
    click(labelled('Remove column 1'));
    click(labelled('Remove column 1'));
    assert.equal(sheet().columns.length, 1);
    assert.equal((labelled('Remove column 1') as HTMLButtonElement).disabled, true);
  });
});

describe('totals card', () => {
  it('shows each row, strong ones as the grand total, and clears when empty', () => {
    form.setLive({
      totals: [
        { label: 'Subtotal', value: '$10' },
        { label: 'Total', value: '$12', strong: true },
      ],
    });
    const cards = $$('dl');
    assert.equal(cards.length, 2, 'every summary card is filled');
    assert.deepEqual(
      $$('dt', cards[0]).map((n) => n.textContent),
      ['Subtotal', 'Total'],
    );
    assert.deepEqual(
      $$('dd', cards[1]).map((n) => n.textContent),
      ['$10', '$12'],
    );
    assert.equal($$('.totals-grand', cards[0]).length, 1);
    assert.ok(group('Half totals').classList.contains('half'));
    form.setLive({});
    assert.equal($$('div', cards[0]).length, 0);
  });
});

describe('redrawing', () => {
  it('replaces whatever was in the host', () => {
    host.innerHTML = '<p id="old">old</p>';
    renderForm(host, FIELDS, defaultsOf(FIELDS), () => {});
    assert.equal(dom.document.getElementById('old'), null);
  });

  it('renders every real document type without error', () => {
    for (const docType of [invoice, serviceLog, custom]) {
      const d = defaultsOf(docType.fields);
      const el = dom.document.createElement('div');
      dom.document.body.append(el);
      assert.doesNotThrow(() => renderForm(el, docType.fields, d, () => {}), docType.id);
      assert.ok(el.querySelector('input,textarea,select'), docType.id);
    }
  });
});

describe('data that is missing pieces', () => {
  it('draws empty inputs for keys the data does not have, instead of "undefined"', () => {
    const el = dom.document.createElement('div');
    dom.document.body.append(el);
    const sparse: Data = {
      billing: {},
      extra: {},
      items: [{}],
      plain: [{}, {}],
      records: [{}],
      tags: [],
      sheet: {
        columns: [{ label: 'A', align: 'left', format: 'text', width: 1, sum: false }],
        rows: [[]],
      },
    };
    renderForm(el, FIELDS, sparse, () => {});
    const values = [
      ...el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
    ].map((i) => i.value);
    assert.ok(
      values.every((v) => v !== 'undefined'),
      'no input shows the word "undefined"',
    );
    assert.equal(
      el.querySelector<HTMLSelectElement>('select')!.value,
      'a4',
      'a missing choice takes its default',
    );
    assert.equal(
      el.querySelector('.card-toggle')!.textContent,
      'Record 1',
      'an untitled record is just numbered',
    );
  });
});
