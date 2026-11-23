// Browser: the dashboard's view (grid or list) and the order of its sections and cards. Both are
// preferences of this browser, kept in localStorage; the config file stays the default order.
//
// Markup it works on (see pages/index.astro, ReorderColumns.astro and the cards):
//   [data-reorder-scope="<page>"]         the page's container; also holds the toolbar
//     [data-reorder-groups]               holds the columns; data-cols = how many are showing
//       [data-reorder-col]                a column (always 4 in the markup, the extra ones hidden)
//         [data-reorder-group="<name>"]   a section (data-reorder-index = its place in the config)
//           .grid                     holds the cards
//             [data-reorder-item="<id>"]  a card (data-reorder-index = its place in the config)
//
// Grid view lays the sections out in 1 to 4 columns. Each section remembers its column; picking a
// different number of columns spreads the sections evenly again. The list view ignores columns.
//
// Reordering is a mode ("Reorder" button). In it every card and section shows one grip
// ([data-reorder-handle]): drag it (pointer events, so mouse, finger and pen all work) or focus it and
// use the arrow keys. With a mouse a whole card can be dragged too. Cards stay in their section;
// sections move between and within columns. Escape cancels a drag. Outside the mode nothing moves,
// so links work.
// After any change the filter bar is told (FILTER_ORDER_EVENT) so its "Default order" follows.

import { FILTER_ORDER_EVENT } from './filter';
import { arrange, distribute, emptyOrder, MAX_COLUMNS, parseOrder, type SavedOrder } from './order';

const VIEW_KEY = 'ui:view';

type View = 'grid' | 'list';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice just doesn't stick.
  }
}

/* ---------- View ---------- */

function showView(view: View) {
  // `data-view` is only set for the list: grid is the default look.
  if (view === 'list') document.documentElement.dataset.view = 'list';
  else delete document.documentElement.dataset.view;
  for (const button of document.querySelectorAll<HTMLElement>('[data-reorder-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.reorderView === view));
  }
}

/* ---------- Order ---------- */

const htmlChildren = (parent: Element) =>
  Array.from(parent.children).filter((el): el is HTMLElement => el instanceof HTMLElement);

const groupsOf = (scope: HTMLElement) =>
  Array.from(scope.querySelectorAll<HTMLElement>('[data-reorder-group]'));

const containerOf = (scope: HTMLElement) =>
  scope.querySelector<HTMLElement>('[data-reorder-groups]');

/** The column elements, left to right (all of them, including the ones not showing). */
const columnsOf = (scope: HTMLElement) =>
  Array.from(containerOf(scope)?.querySelectorAll<HTMLElement>('[data-reorder-col]') ?? []);

/** How many columns are showing. */
const columnCount = (scope: HTMLElement) => {
  const count = Number(containerOf(scope)?.dataset.cols);
  return Number.isInteger(count) && count >= 1 && count <= MAX_COLUMNS ? count : 1;
};

const gridOf = (group: HTMLElement) => group.querySelector<HTMLElement>('.grid');

const itemsOf = (group: HTMLElement) => {
  const grid = gridOf(group);
  return grid ? htmlChildren(grid).filter((el) => el.dataset.reorderItem !== undefined) : [];
};

/** The order the page is in right now. */
function snapshot(scope: HTMLElement): SavedOrder {
  const order = emptyOrder();
  order.columns = columnCount(scope);
  const columns = columnsOf(scope);
  for (const group of groupsOf(scope)) {
    const name = group.dataset.reorderGroup ?? '';
    order.groups.push(name);
    order.items[name] = itemsOf(group).map((item) => item.dataset.reorderItem ?? '');
    order.placement[name] = Math.max(0, columns.indexOf(group.parentElement as HTMLElement));
  }
  return order;
}

function entry(el: HTMLElement, key: string | undefined) {
  return { el, key: key ?? '', index: Number(el.dataset.reorderIndex ?? 0) };
}

/**
 * Puts every section in its column and every card in the saved order (config order where nothing
 * is saved). A section with no saved column goes in the emptiest one.
 */
function applyOrder(scope: HTMLElement, saved: SavedOrder) {
  const container = containerOf(scope);
  if (!container) return;
  const count = saved.columns;
  container.dataset.cols = String(count);
  for (const button of scope.querySelectorAll<HTMLElement>('[data-reorder-cols]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.reorderCols) === count));
  }

  const groups = groupsOf(scope).map((el) => entry(el, el.dataset.reorderGroup));
  const ordered = arrange(groups, saved.groups);
  const columns = columnsOf(scope);
  const placed = distribute(
    ordered.map(({ el }) => itemsOf(el).length + 1), // the cards, and the title
    count,
    ordered.map(({ key }) => saved.placement[key]),
  );
  ordered.forEach(({ el }, i) => columns[placed[i]]?.append(el));

  for (const { el: group, key } of groups) {
    const grid = gridOf(group);
    if (!grid) continue;
    const items = itemsOf(group).map((el) => entry(el, el.dataset.reorderItem));
    for (const { el } of arrange(items, saved.items[key] ?? [])) grid.append(el);
  }
  // The filter bar's "Default order" is whatever the DOM says, so tell it we changed the DOM.
  document.dispatchEvent(new CustomEvent(FILTER_ORDER_EVENT));
}

/** How many columns a grid shows right now (decides whether "next" is to the right or below). */
const trackCount = (grid: HTMLElement) =>
  getComputedStyle(grid).gridTemplateColumns.split(' ').length;

/** Pixels the pointer must travel before a press becomes a drag (so a plain click stays a click). */
const DRAG_THRESHOLD = 5;
/** Distance from the top or bottom of the window where a drag scrolls the page. */
const SCROLL_EDGE = 80;

interface Drag {
  unit: HTMLElement;
  isItem: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  ghost: HTMLElement | null;
  grabX: number;
  grabY: number;
  before: SavedOrder;
}

/* ---------- One page ---------- */

function init(scope: HTMLElement) {
  if (scope.dataset.reorderReady !== undefined) return;
  scope.dataset.reorderReady = '';

  const storeKey = `ui:order:${scope.dataset.reorderScope ?? 'page'}`;
  const status = scope.querySelector<HTMLElement>('[data-reorder-status]');
  const editButton = scope.querySelector<HTMLElement>('[data-reorder-edit]');
  const resetButton = scope.querySelector<HTMLElement>('[data-reorder-reset]');
  const sortSelect = scope.querySelector<HTMLSelectElement>('[data-filter-sort]');
  let editing = false;

  const announce = (text: string) => {
    if (status) status.textContent = text;
  };

  const save = () => {
    write(storeKey, JSON.stringify(snapshot(scope)));
    document.dispatchEvent(new CustomEvent(FILTER_ORDER_EVENT));
  };

  function setEditing(on: boolean) {
    editing = on;
    scope.toggleAttribute('data-editing', on);
    editButton?.setAttribute('aria-pressed', String(on));
    if (resetButton) resetButton.hidden = !on;
    for (const handle of scope.querySelectorAll<HTMLElement>('[data-reorder-handle]'))
      handle.hidden = !on;
    if (status) status.hidden = !on;
    if (!on) endDrag(false);

    if (sortSelect) {
      // Moving cards only makes sense in the default order (any other sort would put them back).
      if (on && sortSelect.value !== 'default') {
        sortSelect.value = 'default';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sortSelect.disabled = on;
    }
    announce(
      on
        ? 'Drag cards and sections by their grips, or focus a grip and use the arrow keys. Saved in this browser.'
        : '',
    );
  }

  /** One place earlier (-1) or later (1) among the visible siblings. */
  function shift(unit: HTMLElement, direction: number) {
    const parent = unit.parentElement;
    if (!parent) return;
    const attribute = unit.dataset.reorderItem !== undefined ? 'reorderItem' : 'reorderGroup';
    const siblings = () =>
      htmlChildren(parent).filter((el) => el.dataset[attribute] !== undefined && !el.hidden);
    const target = siblings()[siblings().indexOf(unit) + direction];
    const name = unit.querySelector('.node-title, .section-title')?.textContent?.trim() || 'It';
    if (!target) {
      announce(`${name} is already ${direction < 0 ? 'first' : 'last'}.`);
      return;
    }
    if (direction < 0) target.before(unit);
    else target.after(unit);
    save();
    announce(`${name} moved to place ${siblings().indexOf(unit) + 1} of ${siblings().length}.`);
  }

  /** Moves a section one column left (-1) or right (1), to the same height in that column. */
  function shiftColumn(group: HTMLElement, direction: number) {
    const columns = columnsOf(scope).slice(0, columnCount(scope));
    const from = columns.indexOf(group.parentElement as HTMLElement);
    const name = group.querySelector('.section-title')?.textContent?.trim() || 'It';
    const to = from + direction;
    if (from < 0 || to < 0 || to >= columns.length) {
      announce(`${name} is already in the ${direction < 0 ? 'first' : 'last'} column.`);
      return;
    }
    const rank = htmlChildren(columns[from]).indexOf(group);
    columns[to].insertBefore(group, htmlChildren(columns[to])[rank] ?? null);
    save();
    announce(`${name} moved to column ${to + 1} of ${columns.length}.`);
  }

  /** A new number of columns: the sections are spread evenly across them again. */
  function setColumns(count: number) {
    if (count === columnCount(scope)) return;
    applyOrder(scope, { ...snapshot(scope), columns: count, placement: {} });
    save();
    announce(count === 1 ? 'One column.' : `${count} columns.`);
  }

  showView(read(VIEW_KEY) === 'list' ? 'list' : 'grid');
  applyOrder(scope, parseOrder(read(storeKey)));

  scope.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const viewButton = target.closest<HTMLElement>('[data-reorder-view]');
    if (viewButton) {
      const view = viewButton.dataset.reorderView === 'list' ? 'list' : 'grid';
      write(VIEW_KEY, view);
      showView(view);
      return;
    }
    if (target.closest('[data-reorder-edit]')) {
      setEditing(!editing);
      return;
    }
    const columnsButton = target.closest<HTMLElement>('[data-reorder-cols]');
    if (columnsButton) {
      setColumns(Number(columnsButton.dataset.reorderCols));
      return;
    }
    if (target.closest('[data-reorder-reset]')) {
      // Back to the config order, spread evenly; how many columns stays (it's a view choice).
      const fresh = { ...emptyOrder(), columns: columnCount(scope) };
      applyOrder(scope, fresh);
      write(storeKey, fresh.columns > 1 ? JSON.stringify(fresh) : null);
      announce('Back to the config order.');
      return;
    }
    // While reordering, a card is something to move, not a link to follow.
    if (editing && target.closest('.node')) event.preventDefault();
  });

  /* ---------- Dragging (pointer events: mouse, touch, pen) ---------- */

  let drag: Drag | null = null;
  let scrollFrame = 0;

  const titleOf = (unit: HTMLElement) =>
    unit.querySelector('.node-title, .section-title')?.textContent?.trim() || 'It';

  const moveGhost = (d: Drag) => {
    if (d.ghost) d.ghost.style.transform = `translate3d(${d.x - d.grabX}px, ${d.y - d.grabY}px, 0)`;
  };

  function startDrag(d: Drag) {
    d.active = true;
    const rect = d.unit.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    if (d.isItem) {
      // A copy of the card, inside a section wrapper so the list view's row styles still apply.
      ghost.className = 'reorder-section reorder-ghost';
      ghost.style.width = `${rect.width}px`;
      const clone = d.unit.cloneNode(true) as HTMLElement;
      for (const name of clone.getAttributeNames()) {
        if (name.startsWith('data-')) clone.removeAttribute(name);
      }
      clone.querySelector('[data-reorder-handle]')?.remove();
      ghost.append(clone);
      d.grabX = d.startX - rect.left;
      d.grabY = d.startY - rect.top;
    } else {
      // A whole section is too big to carry around: a chip with its name, next to the pointer.
      ghost.className = 'reorder-ghost reorder-ghost-chip';
      ghost.textContent = titleOf(d.unit);
      d.grabX = -12;
      d.grabY = -12;
    }
    d.ghost = ghost;
    scope.append(ghost);
    scope.setAttribute('data-dragging', '');
    d.unit.classList.add('is-dragging');
    moveGhost(d);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  /** Scrolls the page while the pointer is near the top or bottom edge. */
  function autoScroll() {
    const d = drag;
    if (!d?.active) return;
    let dy = 0;
    if (d.y < SCROLL_EDGE) dy = -Math.min(24, Math.ceil((SCROLL_EDGE - d.y) / 4));
    else if (d.y > window.innerHeight - SCROLL_EDGE) {
      dy = Math.min(24, Math.ceil((d.y - (window.innerHeight - SCROLL_EDGE)) / 4));
    }
    if (dy) {
      window.scrollBy(0, dy);
      place(d);
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  /** Moves the dragged card or section to where the pointer is. */
  function place(d: Drag) {
    if (d.isItem) placeItem(d);
    else placeGroup(d);
  }

  function placeItem(d: Drag) {
    const grid = d.unit.parentElement;
    if (!grid) return;
    let target: HTMLElement | null = null;
    for (const el of document.elementsFromPoint(d.x, d.y)) {
      const card = el.closest<HTMLElement>('[data-reorder-item]');
      if (card && card !== d.unit && card.parentElement === grid) {
        target = card;
        break;
      }
    }
    if (!target) return;
    const box = target.getBoundingClientRect();
    const after =
      trackCount(grid) > 1 ? d.x > box.left + box.width / 2 : d.y > box.top + box.height / 2;
    if (after) {
      if (target.nextElementSibling !== d.unit) target.after(d.unit);
    } else if (target.previousElementSibling !== d.unit) {
      target.before(d.unit);
    }
  }

  function placeGroup(d: Drag) {
    const rectOf = (el: HTMLElement) => el.getBoundingClientRect();
    // Sections that take up room (a section the filter hid doesn't), not counting this one.
    const groups = groupsOf(scope).filter((g) => g !== d.unit && rectOf(g).height > 0);
    const before = (g: HTMLElement) => d.y < rectOf(g).top + rectOf(g).height / 2;
    // Columns that are laid out (the list view has none: its sections just stack).
    const cols = columnsOf(scope)
      .slice(0, columnCount(scope))
      .filter((col) => rectOf(col).width > 0);

    let parent: HTMLElement | null;
    let ref: HTMLElement | null;
    if (cols.length > 0) {
      // Side by side: the column nearest across. Stacked (a narrow screen): nearest up and down.
      const sideBySide = cols.length > 1 && rectOf(cols[1]).left > rectOf(cols[0]).left + 1;
      const distance = (col: HTMLElement) => {
        const box = rectOf(col);
        return sideBySide
          ? Math.max(box.left - d.x, 0, d.x - box.right)
          : Math.max(box.top - d.y, 0, d.y - box.bottom);
      };
      parent = cols.reduce((best, col) => (distance(col) < distance(best) ? col : best));
      ref = groups.filter((g) => g.parentElement === parent).find(before) ?? null;
    } else {
      ref = groups.find(before) ?? null;
      parent = ref ? ref.parentElement : (groups.at(-1)?.parentElement ?? d.unit.parentElement);
    }
    if (!parent) return;
    if (d.unit.parentElement === parent && d.unit.nextElementSibling === ref) return;
    parent.insertBefore(d.unit, ref);
  }

  const onMove = (event: PointerEvent) => {
    const d = drag;
    if (!d || event.pointerId !== d.pointerId) return;
    d.x = event.clientX;
    d.y = event.clientY;
    if (!d.active) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < DRAG_THRESHOLD) return;
      startDrag(d);
    }
    event.preventDefault();
    moveGhost(d);
    place(d);
  };
  const onUp = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(true);
  };
  const onCancel = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(false);
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    endDrag(false);
  };

  /** Ends a drag: keeps the new place (`keep`), or puts everything back as it was. */
  function endDrag(keep: boolean) {
    const d = drag;
    if (!d) return;
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onEscape);
    cancelAnimationFrame(scrollFrame);
    d.ghost?.remove();
    d.unit.classList.remove('is-dragging');
    scope.removeAttribute('data-dragging');
    if (!d.active) return;
    if (!keep) {
      applyOrder(scope, d.before);
      announce('Move cancelled.');
      return;
    }
    save();
    const name = titleOf(d.unit);
    if (d.isItem) {
      const siblings = itemsOf(d.unit.closest<HTMLElement>('[data-reorder-group]') ?? d.unit);
      announce(`${name} moved to place ${siblings.indexOf(d.unit) + 1} of ${siblings.length}.`);
    } else {
      const cols = columnsOf(scope).slice(0, columnCount(scope));
      const column = cols.indexOf(d.unit.parentElement as HTMLElement) + 1;
      announce(
        cols.length > 1 ? `${name} moved to column ${column} of ${cols.length}.` : `${name} moved.`,
      );
    }
  }

  scope.addEventListener('pointerdown', (event) => {
    if (!editing || drag || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest<HTMLElement>('[data-reorder-handle]');
    const card = event.target.closest<HTMLElement>('[data-reorder-item]');
    // A grip moves its card or section. A mouse can also take a card by any part of it; a finger
    // can't (that has to stay a scroll), which is why the grip exists.
    const unit = handle
      ? (handle.closest<HTMLElement>('[data-reorder-item]') ??
        handle.closest<HTMLElement>('[data-reorder-group]'))
      : event.pointerType === 'mouse'
        ? card
        : null;
    if (!unit) return;
    if (event.pointerType === 'mouse') event.preventDefault(); // no text selection while dragging
    // A touch pointer is tied to the element it started on; the drag follows the window instead.
    try {
      (event.target as Element).releasePointerCapture(event.pointerId);
    } catch {
      // Nothing was captured.
    }
    drag = {
      unit,
      isItem: unit.dataset.reorderItem !== undefined,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      ghost: null,
      grabX: 0,
      grabY: 0,
      before: snapshot(scope),
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onEscape);
  });

  // The browser's own drag of a link or picture would fight ours.
  scope.addEventListener('dragstart', (event) => {
    if (editing) event.preventDefault();
  });

  // A long press on a grip is a drag, not a context menu.
  scope.addEventListener('contextmenu', (event) => {
    if (
      editing &&
      event.target instanceof Element &&
      event.target.closest('[data-reorder-handle]')
    ) {
      event.preventDefault();
    }
  });

  /* Keyboard: focus a grip, then the arrow keys. A card moves earlier or later; a section moves
     up or down in its column, and left or right into the next column. */
  scope.addEventListener('keydown', (event) => {
    if (!editing || !(event.target instanceof Element)) return;
    const handle = event.target.closest<HTMLElement>('[data-reorder-handle]');
    if (!handle || !event.key.startsWith('Arrow')) return;
    const item = handle.closest<HTMLElement>('[data-reorder-item]');
    const group = handle.closest<HTMLElement>('[data-reorder-group]');
    const earlier = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    event.preventDefault();
    if (item) shift(item, earlier ? -1 : 1);
    else if (group) {
      if (horizontal) shiftColumn(group, earlier ? -1 : 1);
      else shift(group, earlier ? -1 : 1);
    }
    handle.focus(); // moving the element can drop focus; keep it on the grip
  });
}

function start() {
  showView(read(VIEW_KEY) === 'list' ? 'list' : 'grid');
  document.querySelectorAll<HTMLElement>('[data-reorder-scope]').forEach(init);
}

document.addEventListener('astro:page-load', start);
