// Renders a type's fields into the page and keeps a plain data object in sync with what is
// typed. The data object is the single source of truth: inputs write into it on every
// keystroke, and structural edits (add/remove/move rows, records, columns) change it and
// redraw just that part of the form. Nothing is stored in the browser.

import type { LiveInfo } from '../doctype';
import {
  clone,
  defaultColumnWidth,
  defaultsOf,
  rowDefaults,
  type Align,
  type CellFormat,
  type Data,
  type Field,
  type GroupField,
  type ListField,
  type ScalarField,
  type SelectField,
  type Sheet,
  type SheetField,
  type TableField,
} from '../schema';

type Attrs = Record<string, string | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

const join = (path: string, key: string | number): string =>
  path ? `${path}.${key}` : String(key);

export interface FormHandle {
  /** Shows computed cells and the totals card. Call after every change. */
  setLive(live: LiveInfo): void;
}

export function renderForm(
  host: HTMLElement,
  fields: readonly Field[],
  data: Data,
  onChange: () => void,
): FormHandle {
  let uid = 0;
  let live: LiveInfo = {};
  const cells = new Map<string, HTMLElement>();
  const summaries: HTMLElement[] = [];

  const dropCells = (prefix: string) => {
    for (const key of [...cells.keys()]) if (key.startsWith(prefix)) cells.delete(key);
  };

  const applyLive = () => {
    for (const [path, el] of cells) el.textContent = live.cells?.[path] ?? '';
    for (const dl of summaries) {
      dl.replaceChildren(
        ...(live.totals ?? []).map((row) =>
          h(
            'div',
            { class: row.strong ? 'totals-grand' : undefined },
            h('dt', {}, row.label),
            h('dd', {}, row.value),
          ),
        ),
      );
    }
  };

  const help = (text: string | undefined) => (text ? h('p', { class: 'help' }, text) : undefined);

  const iconButton = (glyph: string, label: string, onClick: () => void, disabled = false) => {
    const button = h(
      'button',
      { type: 'button', class: 'btn btn-icon btn-sm', 'aria-label': label, title: label },
      glyph,
    );
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  };

  const choose = (
    options: readonly [string, string][],
    value: string,
    label: string,
    set: (v: string) => void,
  ) => {
    // Same look as the site's <Select> component (styles/components/select.css).
    const select = h('select', { class: 'select select--sm', 'aria-label': label });
    for (const [optionValue, optionLabel] of options) {
      select.append(h('option', { value: optionValue }, optionLabel));
    }
    select.value = value;
    select.addEventListener('change', () => set(select.value));
    return select;
  };

  // ---- Fields -------------------------------------------------------------------------------

  function buildFields(parent: HTMLElement, list: readonly Field[], obj: Data, path: string): void {
    for (const field of list) {
      switch (field.kind) {
        case 'group':
          parent.append(buildGroup(field, obj, path));
          break;
        case 'table':
          parent.append(buildTable(field, obj, join(path, field.key)));
          break;
        case 'list':
          parent.append(buildList(field, obj, join(path, field.key)));
          break;
        case 'sheet':
          parent.append(buildSheet(field, obj));
          break;
        case 'summary': {
          const dl = h('dl');
          summaries.push(dl);
          parent.append(
            h(
              'fieldset',
              {
                class: field.half ? 'group half totals' : 'group totals',
                'aria-label': field.label,
              },
              h('legend', {}, field.label),
              dl,
            ),
          );
          break;
        }
        case 'select':
          parent.append(buildSelect(field, obj));
          break;
        default:
          parent.append(buildScalar(field, obj));
      }
    }
  }

  function buildGroup(field: GroupField, obj: Data, path: string): HTMLElement {
    const target = field.key ? (obj[field.key] as Data) : obj;
    const inner = field.key ? join(path, field.key) : path;
    if (!field.label) {
      const wrapper = h('div', { class: 'contents' });
      buildFields(wrapper, field.fields, target, inner);
      return wrapper;
    }
    const grid = h('div', { class: field.stack ? 'fields fields-one' : 'fields' });
    buildFields(grid, field.fields, target, inner);
    return h(
      'fieldset',
      { class: field.half ? 'group half' : 'group' },
      h('legend', {}, field.label),
      grid,
    );
  }

  function buildScalar(field: ScalarField, obj: Data): HTMLElement {
    const label = h(
      'label',
      { class: field.kind === 'color' ? 'field field-color' : 'field' },
      field.label,
    );
    let input: HTMLInputElement | HTMLTextAreaElement;
    if (field.kind === 'textarea') {
      input = h('textarea', { rows: String(field.rows ?? 3), placeholder: field.placeholder });
    } else {
      const type =
        field.kind === 'date' || field.kind === 'email' || field.kind === 'color'
          ? field.kind
          : 'text';
      input = h('input', {
        type,
        maxlength: field.maxLength ? String(field.maxLength) : undefined,
        placeholder: field.placeholder,
        inputmode: field.kind === 'decimal' ? 'decimal' : undefined,
        spellcheck: field.kind === 'currency' || field.kind === 'locale' ? 'false' : undefined,
      });
      if (field.suggestions) {
        const id = `suggest-${++uid}`;
        input.setAttribute('list', id);
        const datalist = h('datalist', { id });
        for (const value of field.suggestions) datalist.append(h('option', { value }));
        label.append(datalist);
      }
    }
    input.value = String(obj[field.key] ?? '');
    input.addEventListener('input', () => {
      obj[field.key] = input.value;
      onChange();
    });
    label.append(input);
    const hint = help(field.help);
    if (hint) label.append(hint);
    return label;
  }

  function buildSelect(field: SelectField, obj: Data): HTMLElement {
    const select = choose(
      field.options.map((o): [string, string] => [o.value, o.label]),
      String(obj[field.key] ?? field.default),
      field.label,
      (value) => {
        obj[field.key] = value;
        onChange();
      },
    );
    select.removeAttribute('aria-label');
    return h('label', { class: 'field' }, field.label, select);
  }

  // ---- Table: rows of type-defined columns ---------------------------------------------------

  function buildTable(field: TableField, obj: Data, path: string): HTMLElement {
    const rows = obj[field.key] as Data[];
    const columns = field.columns;
    const min = field.minRows ?? 1;
    const template = [...columns.map(defaultColumnWidth), '2rem'].join(' ');
    const rowLabel = field.rowLabel ?? 'Row';

    const head = h(
      'div',
      { class: 'rows-head', 'aria-hidden': 'true' },
      ...columns.map((column) =>
        h(
          'span',
          { class: column.type === 'decimal' || column.type === 'computed' ? 'num' : undefined },
          column.label,
        ),
      ),
      h('span'),
    );
    head.style.setProperty('--cols', template);
    const body = h('div', { class: 'rows' });

    const buildRow = (row: Data, index: number): HTMLElement => {
      const el = h('div', { class: 'row' });
      el.style.setProperty('--cols', template);
      for (const column of columns) {
        if (column.type === 'computed') {
          const output = h('output', { class: 'row-amount' });
          cells.set(`${path}.${index}.${column.key}`, output);
          el.append(output);
          continue;
        }
        const input =
          column.type === 'textarea'
            ? h('textarea', { rows: '2' })
            : h('input', {
                type: 'text',
                inputmode: column.type === 'decimal' ? 'decimal' : undefined,
              });
        input.setAttribute('aria-label', column.label);
        input.placeholder = column.label;
        input.value = String(row[column.key] ?? '');
        input.addEventListener('input', () => {
          row[column.key] = input.value;
          onChange();
        });
        el.append(input);
      }
      el.append(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-icon btn-sm row-remove',
            'aria-label': `Remove ${rowLabel.toLowerCase()} ${index + 1}`,
          },
          '\u00d7',
        ),
      );
      el.querySelector('.row-remove')!.addEventListener('click', () => {
        rows.splice(index, 1);
        while (rows.length < min) rows.push(rowDefaults(columns));
        render();
        onChange();
      });
      return el;
    };

    const render = () => {
      dropCells(`${path}.`);
      body.replaceChildren(...rows.map(buildRow));
    };
    render();

    const add = h(
      'button',
      { type: 'button', class: 'btn' },
      field.addLabel ?? `Add ${rowLabel.toLowerCase()}`,
    );
    add.addEventListener('click', () => {
      rows.push(rowDefaults(columns));
      render();
      onChange();
      body.querySelector<HTMLElement>('.row:last-child input, .row:last-child textarea')?.focus();
    });

    const box = h('fieldset', { class: 'group' }, h('legend', {}, field.label));
    const hint = help(field.help);
    if (hint) box.append(hint);
    box.append(head, body, add);
    return box;
  }

  // ---- List: repeatable cards ----------------------------------------------------------------

  function buildList(field: ListField, obj: Data, path: string): HTMLElement {
    const items = obj[field.key] as Data[];
    const min = field.min ?? 1;
    const open = new WeakMap<Data, boolean>();
    const body = h('div', { class: 'cards' });
    const noun = field.itemLabel.toLowerCase();

    const titleOf = (item: Data) => {
      const name = field.titleKey ? String(item[field.titleKey] ?? '').trim() : '';
      return `${field.itemLabel} ${items.indexOf(item) + 1}${name ? `: ${name}` : ''}`;
    };

    const buildCard = (item: Data, index: number): HTMLElement => {
      const isOpen = open.get(item) ?? items.length <= 3;
      const bodyId = `card-${++uid}`;
      const toggle = h(
        'button',
        {
          type: 'button',
          class: 'card-toggle',
          'aria-expanded': String(isOpen),
          'aria-controls': bodyId,
        },
        titleOf(item),
      );
      const inner = h('div', { class: 'card-body', id: bodyId });
      inner.hidden = !isOpen;
      buildFields(inner, field.fields, item, join(path, index));

      toggle.addEventListener('click', () => {
        inner.hidden = !inner.hidden;
        open.set(item, !inner.hidden);
        toggle.setAttribute('aria-expanded', String(!inner.hidden));
      });
      inner.addEventListener('input', () => {
        toggle.textContent = titleOf(item);
      });

      const move = (by: number) => {
        const target = index + by;
        [items[index], items[target]] = [items[target], items[index]];
        render();
        onChange();
      };
      const actions = h(
        'div',
        { class: 'card-actions' },
        iconButton('\u2191', `Move ${noun} ${index + 1} up`, () => move(-1), index === 0),
        iconButton(
          '\u2193',
          `Move ${noun} ${index + 1} down`,
          () => move(1),
          index === items.length - 1,
        ),
        iconButton('Copy', `Duplicate ${noun} ${index + 1}`, () => {
          const copy = clone(item);
          open.set(copy, true);
          items.splice(index + 1, 0, copy);
          render();
          onChange();
        }),
        iconButton(
          '\u00d7',
          `Remove ${noun} ${index + 1}`,
          () => {
            items.splice(index, 1);
            render();
            onChange();
          },
          items.length <= min,
        ),
      );
      return h('div', { class: 'card' }, h('div', { class: 'card-head' }, toggle, actions), inner);
    };

    const render = () => {
      dropCells(`${path}.`);
      body.replaceChildren(...items.map(buildCard));
    };
    render();

    const add = h('button', { type: 'button', class: 'btn' }, field.addLabel ?? `Add ${noun}`);
    add.addEventListener('click', () => {
      const item = defaultsOf(field.fields);
      open.set(item, true);
      items.push(item);
      render();
      onChange();
      body.querySelector<HTMLElement>('.card:last-child input, .card:last-child textarea')?.focus();
    });

    const box = h('fieldset', { class: 'group' }, h('legend', {}, field.label));
    const hint = help(field.help);
    if (hint) box.append(hint);
    box.append(body, add);
    return box;
  }

  // ---- Sheet: a table whose columns are chosen by the person using the tool ------------------

  function buildSheet(field: SheetField, obj: Data): HTMLElement {
    const sheet = obj[field.key] as Sheet;
    const MAX_COLUMNS = 12;

    const columnsHead = h(
      'div',
      { class: 'col-row rows-head', 'aria-hidden': 'true' },
      ...['Column name', 'Align', 'Format', 'Width', 'Total', ''].map((text) =>
        h('span', {}, text),
      ),
    );
    const columnsBody = h('div', { class: 'rows' });
    const rowsHead = h('div', { class: 'rows-head', 'aria-hidden': 'true' });
    const rowsBody = h('div', { class: 'rows' });

    const template = () =>
      [...sheet.columns.map((c) => `minmax(0, ${c.width}fr)`), '2rem'].join(' ');
    const nameOf = (index: number) => sheet.columns[index].label || `Column ${index + 1}`;

    const renderRowsHead = () => {
      rowsHead.style.setProperty('--cols', template());
      rowsHead.replaceChildren(...sheet.columns.map((_, i) => h('span', {}, nameOf(i))), h('span'));
    };

    const renderRows = () => {
      renderRowsHead();
      rowsBody.replaceChildren(
        ...sheet.rows.map((row, r) => {
          const el = h('div', { class: 'row' });
          el.style.setProperty('--cols', template());
          sheet.columns.forEach((column, c) => {
            const input = h('input', {
              type: 'text',
              'aria-label': nameOf(c),
              placeholder: column.format === 'date' ? 'YYYY-MM-DD' : nameOf(c),
              inputmode:
                column.format === 'number' || column.format === 'money' ? 'decimal' : undefined,
            });
            input.value = row[c] ?? '';
            input.style.textAlign = column.align;
            input.addEventListener('input', () => {
              row[c] = input.value;
              onChange();
            });
            el.append(input);
          });
          const remove = h(
            'button',
            {
              type: 'button',
              class: 'btn btn-icon btn-sm row-remove',
              'aria-label': `Remove row ${r + 1}`,
            },
            '\u00d7',
          );
          remove.addEventListener('click', () => {
            sheet.rows.splice(r, 1);
            renderRows();
            onChange();
          });
          el.append(remove);
          return el;
        }),
      );
    };

    const renderColumns = () => {
      columnsBody.replaceChildren(
        ...sheet.columns.map((column, i) => {
          const name = h('input', {
            type: 'text',
            'aria-label': `Column ${i + 1} name`,
            placeholder: `Column ${i + 1}`,
          });
          name.value = column.label;
          name.addEventListener('input', () => {
            column.label = name.value;
            renderRowsHead();
            onChange();
          });

          const align = choose(
            [
              ['left', 'Left'],
              ['center', 'Center'],
              ['right', 'Right'],
            ],
            column.align,
            `Column ${i + 1} alignment`,
            (value) => {
              column.align = value as Align;
              renderRows();
              onChange();
            },
          );
          const format = choose(
            [
              ['text', 'Text'],
              ['number', 'Number'],
              ['money', 'Money'],
              ['date', 'Date'],
            ],
            column.format,
            `Column ${i + 1} format`,
            (value) => {
              column.format = value as CellFormat;
              renderRows();
              onChange();
            },
          );
          const width = h('input', {
            type: 'number',
            min: '1',
            max: '8',
            step: '1',
            'aria-label': `Column ${i + 1} width`,
          });
          width.value = String(column.width);
          width.addEventListener('input', () => {
            const value = Math.round(Number(width.value));
            column.width = Math.min(8, Math.max(1, Number.isFinite(value) ? value : 1));
            renderRowsHead();
            renderRows();
            onChange();
          });
          const sum = h('input', { type: 'checkbox', 'aria-label': `Total column ${i + 1}` });
          sum.checked = column.sum;
          sum.addEventListener('change', () => {
            column.sum = sum.checked;
            onChange();
          });
          const remove = iconButton(
            '\u00d7',
            `Remove column ${i + 1}`,
            () => {
              sheet.columns.splice(i, 1);
              for (const row of sheet.rows) row.splice(i, 1);
              renderColumns();
              renderRows();
              onChange();
            },
            sheet.columns.length <= 1,
          );
          return h('div', { class: 'col-row' }, name, align, format, width, sum, remove);
        }),
      );
    };

    renderColumns();
    renderRows();

    const addColumn = h('button', { type: 'button', class: 'btn' }, 'Add column');
    addColumn.addEventListener('click', () => {
      if (sheet.columns.length >= MAX_COLUMNS) return;
      sheet.columns.push({ label: '', align: 'left', format: 'text', width: 1, sum: false });
      for (const row of sheet.rows) row.push('');
      renderColumns();
      renderRows();
      onChange();
      columnsBody.querySelector<HTMLElement>('.col-row:last-child input')?.focus();
    });
    const addRow = h('button', { type: 'button', class: 'btn' }, 'Add row');
    addRow.addEventListener('click', () => {
      sheet.rows.push(sheet.columns.map(() => ''));
      renderRows();
      onChange();
      rowsBody.querySelector<HTMLElement>('.row:last-child input')?.focus();
    });

    return h(
      'fieldset',
      { class: 'group' },
      h('legend', {}, field.label),
      h(
        'p',
        { class: 'help' },
        'Name the columns first, then fill in the rows. Width is a relative share (1 to 8).',
      ),
      columnsHead,
      columnsBody,
      addColumn,
      h('h3', { class: 'subhead' }, 'Rows'),
      rowsHead,
      rowsBody,
      addRow,
    );
  }

  host.replaceChildren();
  buildFields(host, fields, data, '');

  return {
    setLive(next) {
      live = next;
      applyLive();
    },
  };
}
