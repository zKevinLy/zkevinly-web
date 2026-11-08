// Page-local filter / search / sort, shared by the build (FilterBar markup, card
// attributes) and the browser (FilterBar script). Keep this file free of
// Node-only APIs.
//
// ONE query string drives everything. Typing "tv bro" is a text term; clicking
// the "browser" chip simply adds the term `tag:browser` to that same string. So
// there is a single parser and a single matcher; "search" and "filter" are the
// same operation, and the chips are just shortcuts for typing a `tag:` term.

import type { Entry, TopicPage } from '../config/types';
import { entryRepo } from './github';

/* ---------- Query: parse, match, edit ---------- */

export interface Term {
  /** Absent = plain text matched anywhere on the item. */
  field?: 'tag';
  value: string;
}

const FIELDS: ReadonlySet<string> = new Set(['tag']);

/** field:value, "quoted phrase", or a bare word. */
const TOKEN = /(?:(\w+):)?(?:"([^"]*)"|(\S+))/g;

/** Lowercase, strip accents, collapse whitespace. Used on both sides of every comparison. */
export function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseQuery(query: string): Term[] {
  const terms: Term[] = [];

  for (const match of query.matchAll(TOKEN)) {
    const [raw, field, quoted, bare] = match;

    // "tag:" while the person is still typing the value: ignore it.
    if (/^\w+:$/.test(raw)) continue;

    if (field && FIELDS.has(field.toLowerCase())) {
      const value = normalize(quoted ?? bare ?? '');
      if (value) terms.push({ field: 'tag', value });
    } else {
      // Unknown "field:" (e.g. a URL) is just text.
      const value = normalize(field ? raw.replace(/"/g, '') : (quoted ?? bare ?? ''));
      if (value) terms.push({ value });
    }
  }

  return terms;
}

export function serializeQuery(terms: Term[]): string {
  const quote = (value: string) => (/\s/.test(value) ? `"${value}"` : value);
  return terms.map((t) => (t.field ? `${t.field}:${quote(t.value)}` : quote(t.value))).join(' ');
}

/** Adds the tag as a `tag:` term, or removes it if it's already there. */
export function toggleTag(query: string, tag: string): string {
  const value = normalize(tag);
  const terms = parseQuery(query);
  const has = terms.some((t) => t.field === 'tag' && t.value === value);

  return serializeQuery(
    has
      ? terms.filter((t) => !(t.field === 'tag' && t.value === value))
      : [...terms, { field: 'tag', value }],
  );
}

export function activeTags(query: string): Set<string> {
  return new Set(
    parseQuery(query)
      .filter((t) => t.field === 'tag')
      .map((t) => t.value),
  );
}

/** What the matcher and sorter know about one item. */
export interface FilterItem {
  title: string;
  /** Normalised title + description + label + tags + repo. */
  text: string;
  /** Normalised. */
  tags: string[];
  /** Epoch ms, or null when unknown. */
  updated: number | null;
  stars: number | null;
}

/** Every term must match (AND). The only matcher: text box and tag chips both end up here. */
export function matches(item: FilterItem, terms: Term[]): boolean {
  return terms.every((t) =>
    t.field === 'tag' ? item.tags.includes(t.value) : item.text.includes(t.value),
  );
}

/* ---------- Sort ---------- */

export type SortKey = 'default' | 'title' | 'updated' | 'stars';

export const SORT_LABELS: Record<SortKey, string> = {
  default: 'Default order',
  title: 'A–Z',
  updated: 'Recently updated',
  stars: 'Most stars',
};

export const isSortKey = (value: string): value is SortKey => value in SORT_LABELS;

/** Indexes of `items` in display order. Unknown values sort last; ties keep the original order. */
export function sortOrder(items: FilterItem[], key: SortKey): number[] {
  const order = items.map((_, i) => i);
  if (key === 'default') return order;

  const byNumberDesc = (pick: (item: FilterItem) => number | null) => (a: number, b: number) => {
    const x = pick(items[a]);
    const y = pick(items[b]);
    if (x === y) return a - b;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || a - b;
  };

  const compare =
    key === 'title'
      ? (a: number, b: number) =>
          items[a].title.localeCompare(items[b].title, 'en', {
            numeric: true,
            sensitivity: 'base',
          }) || a - b
      : key === 'updated'
        ? byNumberDesc((item) => item.updated)
        : byNumberDesc((item) => item.stars);

  return order.sort(compare);
}

/* ---------- Item attributes: the one contract between markup and script ---------- */

/** Everything the filter needs to know about something that can sit in a filtered list. */
export interface FilterSource {
  title: string;
  description?: string;
  label?: string;
  tags?: string[];
  /** "owner/name": its release/stars/updated arrive from GitHub. */
  repo?: string | null;
  /** Manual ISO date for entries that aren't on GitHub. */
  updated?: string;
}

export const FILTER_REFRESH_EVENT = 'filter:refresh';

export function entrySource(entry: Entry): FilterSource {
  return {
    title: entry.title,
    description: entry.description,
    tags: entry.tags,
    repo: entryRepo(entry),
    updated: entry.updated,
  };
}

/** Spread onto a Node: `<Node {...filterAttrs(source)} />`. */
export function filterAttrs(
  source: FilterSource,
  stats?: { pushedAt?: string; stars?: number } | null,
): Record<string, string | undefined> {
  const tags = (source.tags ?? []).map(normalize);

  return {
    'data-filter-item': '',
    'data-filter-title': source.title,
    'data-filter-text': normalize(
      [source.title, source.description, source.label, source.repo, ...tags]
        .filter(Boolean)
        .join(' '),
    ),
    'data-filter-tags': tags.join(','),
    'data-filter-updated': stats?.pushedAt ?? source.updated,
    'data-filter-stars': stats?.stars === undefined ? undefined : String(stats.stars),
  };
}

/** Browser side of the contract above. */
export function readItem(el: HTMLElement): FilterItem {
  const { filterTitle, filterText, filterTags, filterUpdated, filterStars } = el.dataset;
  const time = filterUpdated ? Date.parse(filterUpdated) : NaN;
  const stars = filterStars ? Number(filterStars) : NaN;

  return {
    title: filterTitle ?? '',
    text: filterText ?? '',
    tags: filterTags ? filterTags.split(',') : [],
    updated: Number.isNaN(time) ? null : time,
    stars: Number.isNaN(stars) ? null : stars,
  };
}

/** Lets late GitHub data (fetched in the browser) feed the sort. Call `FILTER_REFRESH_EVENT` after. */
export function writeStats(el: HTMLElement | null, stats: { pushedAt?: string; stars?: number }) {
  if (!el) return;
  if (stats.pushedAt) el.dataset.filterUpdated = stats.pushedAt;
  if (stats.stars !== undefined) el.dataset.filterStars = String(stats.stars);
}

/* ---------- What a page offers ---------- */

/** Below this many items a filter bar is just noise. */
export const MIN_FILTER_ITEMS = 3;

export interface FilterModel {
  total: number;
  /** Tags worth a chip: present on some items but not all of them. */
  tags: string[];
  sorts: SortKey[];
}

export function buildFilterModel(
  sources: FilterSource[],
  { force = false }: { force?: boolean } = {},
): FilterModel | null {
  if (sources.length === 0 || (!force && sources.length < MIN_FILTER_ITEMS)) return null;

  const counts = new Map<string, number>();
  for (const source of sources) {
    for (const tag of new Set((source.tags ?? []).map(normalize))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const tags = [...counts]
    .filter(([, count]) => count < sources.length)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);

  const sorts: SortKey[] = ['default', 'title'];
  if (sources.some((s) => s.repo || s.updated)) sorts.push('updated');
  if (sources.some((s) => s.repo)) sorts.push('stars');

  return { total: sources.length, tags, sorts };
}

/**
 * Everything on a topic page that FilterBar can filter. Hubs are excluded: their
 * workflow is an ordered path, not a list.
 */
export function pageSources(page: TopicPage): FilterSource[] {
  if (page.hub) return [];

  const children = (page.children ?? []).map((child) => ({
    title: child.title,
    description: child.description,
    tags: child.tags,
  }));

  const fromBlocks = page.blocks.flatMap((block): FilterSource[] => {
    if (block.type === 'links') {
      return block.items.map((l) => ({
        title: l.title,
        description: l.description,
        label: l.label,
        tags: l.tags,
      }));
    }
    if (block.type === 'entries') return block.items.map(entrySource);
    return [];
  });

  return [...children, ...fromBlocks];
}
