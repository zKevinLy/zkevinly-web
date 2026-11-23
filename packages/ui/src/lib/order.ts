// The dashboard's saved order (kept per browser, in localStorage). Pure helpers with no DOM so they
// can be tested; src/lib/reorder.ts does the dragging and the saving.

/** The most columns the sections can be laid out in (grid view). */
export const MAX_COLUMNS = 4;

/**
 * What is stored: the order of the sections, and for each section the order of its cards. Names
 * are the section's name and each card's id (a service's `id`, a bookmark's `href`). `columns` is
 * how many columns the sections are laid out in, and `placement` which column (0-based) each
 * section sits in; a section with no placement is put in the emptiest column (see `distribute`).
 */
export interface SavedOrder {
  groups: string[];
  items: Record<string, string[]>;
  columns: number;
  placement: Record<string, number>;
}

export const emptyOrder = (): SavedOrder => ({ groups: [], items: {}, columns: 1, placement: {} });

const isIndex = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < limit;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

/**
 * Reads what localStorage held. Anything that isn't the expected shape (old version, hand-edited,
 * corrupt) counts as "nothing saved", so a bad value can never break the page.
 */
export function parseOrder(text: string | null | undefined): SavedOrder {
  if (!text) return emptyOrder();
  // Untrusted JSON: every field is shape-checked below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch {
    return emptyOrder();
  }
  if (!doc || typeof doc !== 'object' || !isStrings(doc.groups)) return emptyOrder();
  if (!doc.items || typeof doc.items !== 'object' || Array.isArray(doc.items)) return emptyOrder();

  const items: Record<string, string[]> = {};
  for (const [name, list] of Object.entries(doc.items)) {
    if (name !== '__proto__' && isStrings(list)) items[name] = list;
  }

  // Saved before columns existed: one column, nothing placed. A bad value only loses the columns.
  const columns =
    Number.isInteger(doc.columns) && doc.columns >= 1 && doc.columns <= MAX_COLUMNS
      ? doc.columns
      : 1;
  const placement: Record<string, number> = {};
  if (doc.placement && typeof doc.placement === 'object' && !Array.isArray(doc.placement)) {
    for (const [name, column] of Object.entries(doc.placement)) {
      if (name !== '__proto__' && isIndex(column, MAX_COLUMNS)) placement[name] = column;
    }
  }
  return { groups: doc.groups, items, columns, placement };
}

/**
 * Which column each section goes in. Sections already placed (`fixed[i]`, a column number) stay
 * where they are; the rest go one by one, in order, into the column with the least in it so far,
 * the leftmost on a tie. `weights[i]` is how much room section i takes (its cards, plus its title).
 * A fixed column that doesn't exist (`>= count`) counts as not placed.
 * @param count how many columns there are (at least 1).
 * @returns a column number per section.
 */
export function distribute(
  weights: number[],
  count: number,
  fixed: (number | undefined)[] = [],
): number[] {
  const load: number[] = new Array(count).fill(0);
  const result: number[] = weights.map(() => -1);
  weights.forEach((weight, i) => {
    const column = fixed[i];
    if (isIndex(column, count)) {
      result[i] = column;
      load[column] += weight;
    }
  });
  weights.forEach((weight, i) => {
    if (result[i] !== -1) return;
    const column = load.indexOf(Math.min(...load));
    result[i] = column;
    load[column] += weight;
  });
  return result;
}

/**
 * Puts entries in display order: the ones named in `saved` first, in that order; everything else
 * (new in the config since it was saved) after them, in config order. Names in `saved` that no
 * longer exist are ignored. Returns a new array.
 * `index` is each entry's position in the config.
 */
export function arrange<T extends { key: string; index: number }>(
  entries: T[],
  saved: string[],
): T[] {
  const rank = new Map<string, number>();
  saved.forEach((key, i) => {
    if (!rank.has(key)) rank.set(key, i);
  });
  return [...entries].sort((a, b) => {
    const ra = rank.get(a.key);
    const rb = rank.get(b.key);
    if (ra !== undefined && rb !== undefined) return ra - rb || a.index - b.index;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.index - b.index;
  });
}
