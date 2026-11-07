import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_FILTER_ITEMS,
  activeTags,
  buildFilterModel,
  entrySource,
  filterAttrs,
  isSortKey,
  matches,
  normalize,
  pageSources,
  parseQuery,
  readItem,
  serializeQuery,
  sortOrder,
  toggleTag,
  writeStats,
  type FilterItem,
  type FilterSource,
} from '../../src/lib/filter';
import type { TopicPage } from '../../src/config/types';

/** The browser helpers only touch `.dataset`, so a plain object stands in for an element. */
const fakeEl = (dataset: Record<string, string | undefined> = {}) =>
  ({ dataset }) as unknown as HTMLElement;

const item = (over: Partial<FilterItem> = {}): FilterItem => ({
  title: 'Item',
  text: 'item',
  tags: [],
  updated: null,
  stars: null,
  ...over,
});

describe('normalize', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    assert.equal(normalize('  Café   Ñandú \n'), 'cafe nandu');
    assert.equal(normalize('TV Bro'), 'tv bro');
    assert.equal(normalize(''), '');
  });
});

describe('parseQuery', () => {
  it('splits bare words into text terms', () => {
    assert.deepEqual(parseQuery('tv bro'), [{ value: 'tv' }, { value: 'bro' }]);
  });

  it('keeps quoted phrases together', () => {
    assert.deepEqual(parseQuery('"tv bro"'), [{ value: 'tv bro' }]);
  });

  it('parses tag: terms, case-insensitively', () => {
    assert.deepEqual(parseQuery('tag:Browser TAG:media'), [
      { field: 'tag', value: 'browser' },
      { field: 'tag', value: 'media' },
    ]);
    assert.deepEqual(parseQuery('tag:"android tv"'), [{ field: 'tag', value: 'android tv' }]);
  });

  it('ignores a half-typed "tag:"', () => {
    assert.deepEqual(parseQuery('tag:'), []);
    assert.deepEqual(parseQuery('nuvio tag:'), [{ value: 'nuvio' }]);
  });

  it('treats unknown fields (e.g. URLs) as plain text', () => {
    assert.deepEqual(parseQuery('https://example.com'), [{ value: 'https://example.com' }]);
    assert.deepEqual(parseQuery('foo:bar'), [{ value: 'foo:bar' }]);
  });

  it('returns nothing for blank input', () => {
    assert.deepEqual(parseQuery(''), []);
    assert.deepEqual(parseQuery('   '), []);
  });
});

describe('serializeQuery / toggleTag / activeTags', () => {
  it('round-trips through parseQuery', () => {
    const query = 'nuvio "tv bro" tag:browser tag:"android tv"';
    assert.equal(serializeQuery(parseQuery(query)), query);
  });

  it('adds a tag term, then removes it again', () => {
    const added = toggleTag('nuvio', 'Browser');
    assert.equal(added, 'nuvio tag:browser');
    assert.equal(toggleTag(added, 'browser'), 'nuvio');
  });

  it('quotes tags that contain spaces', () => {
    assert.equal(toggleTag('', 'android tv'), 'tag:"android tv"');
  });

  it('reports which tags are active', () => {
    assert.deepEqual([...activeTags('x tag:a tag:B')].sort(), ['a', 'b']);
    assert.equal(activeTags('just text').size, 0);
  });
});

describe('matches', () => {
  const nuvio = item({ text: 'nuvio official android tv app', tags: ['android-tv', 'media'] });

  it('matches everything when there are no terms', () => assert.equal(matches(nuvio, []), true));
  it('matches text anywhere in the item text', () =>
    assert.equal(matches(nuvio, parseQuery('official app')), true));
  it('requires exact tag matches for tag: terms', () => {
    assert.equal(matches(nuvio, parseQuery('tag:media')), true);
    assert.equal(matches(nuvio, parseQuery('tag:med')), false);
  });
  it('ANDs all terms', () => {
    assert.equal(matches(nuvio, parseQuery('nuvio tag:media')), true);
    assert.equal(matches(nuvio, parseQuery('nuvio tag:browser')), false);
  });
  it('does not match a tag term against the text', () => {
    assert.equal(matches(item({ text: 'browser' }), parseQuery('tag:browser')), false);
  });
});

describe('sortOrder', () => {
  it('keeps the original order for "default"', () => {
    assert.deepEqual(sortOrder([item(), item(), item()], 'default'), [0, 1, 2]);
  });

  it('sorts titles A–Z, naturally and ignoring case', () => {
    const items = ['b', 'A', 'c10', 'c2'].map((title) => item({ title }));
    assert.deepEqual(sortOrder(items, 'title'), [1, 0, 3, 2]);
  });

  it('sorts by stars descending, unknowns last, ties stable', () => {
    const items = [10, null, 30, 10].map((stars) => item({ stars }));
    assert.deepEqual(sortOrder(items, 'stars'), [2, 0, 3, 1]);
  });

  it('sorts by updated descending, unknowns last', () => {
    const items = [100, null, 300, 200].map((updated) => item({ updated }));
    assert.deepEqual(sortOrder(items, 'updated'), [2, 3, 0, 1]);
  });

  it('does not mutate its input', () => {
    const items = [item({ stars: 1 }), item({ stars: 2 })];
    sortOrder(items, 'stars');
    assert.deepEqual(
      items.map((i) => i.stars),
      [1, 2],
    );
  });
});

describe('isSortKey', () => {
  it('only accepts known keys', () => {
    for (const key of ['default', 'title', 'updated', 'stars']) assert.equal(isSortKey(key), true);
    assert.equal(isSortKey('random'), false);
    assert.equal(isSortKey(''), false);
  });
});

describe('filterAttrs', () => {
  const source: FilterSource = {
    title: 'Nuvio',
    description: 'Official app',
    tags: ['Android-TV', 'Media'],
    repo: 'NuvioMedia/NuvioTV',
    updated: '2020-01-01',
  };

  it('builds normalised searchable text and tags', () => {
    const attrs = filterAttrs(source);
    assert.equal(attrs['data-filter-item'], '');
    assert.equal(attrs['data-filter-title'], 'Nuvio');
    assert.equal(
      attrs['data-filter-text'],
      'nuvio official app nuviomedia/nuviotv android-tv media',
    );
    assert.equal(attrs['data-filter-tags'], 'android-tv,media');
  });

  it('prefers live stats over the manual date', () => {
    const attrs = filterAttrs(source, { pushedAt: '2026-11-07T00:00:00Z', stars: 3396 });
    assert.equal(attrs['data-filter-updated'], '2026-11-07T00:00:00Z');
    assert.equal(attrs['data-filter-stars'], '3396');
  });

  it('falls back to the manual date and omits unknown stars', () => {
    const attrs = filterAttrs(source, null);
    assert.equal(attrs['data-filter-updated'], '2020-01-01');
    assert.equal(attrs['data-filter-stars'], undefined);
  });

  it('keeps a star count of zero', () => {
    assert.equal(filterAttrs(source, { stars: 0 })['data-filter-stars'], '0');
  });
});

describe('readItem / writeStats', () => {
  it('reads what filterAttrs wrote', () => {
    const el = fakeEl({
      filterTitle: 'Nuvio',
      filterText: 'nuvio media',
      filterTags: 'android-tv,media',
      filterUpdated: '2026-11-07T00:00:00Z',
      filterStars: '3396',
    });
    assert.deepEqual(readItem(el), {
      title: 'Nuvio',
      text: 'nuvio media',
      tags: ['android-tv', 'media'],
      updated: Date.parse('2026-11-07T00:00:00Z'),
      stars: 3396,
    });
  });

  it('tolerates missing or invalid data', () => {
    assert.deepEqual(readItem(fakeEl()), {
      title: '',
      text: '',
      tags: [],
      updated: null,
      stars: null,
    });
    const bad = readItem(fakeEl({ filterUpdated: 'nope', filterStars: 'many' }));
    assert.equal(bad.updated, null);
    assert.equal(bad.stars, null);
  });

  it('treats "0" stars as 0, not unknown', () => {
    assert.equal(readItem(fakeEl({ filterStars: '0' })).stars, 0);
  });

  it('writeStats feeds late GitHub data back into the item', () => {
    const el = fakeEl();
    writeStats(el, { pushedAt: '2026-11-07T00:00:00Z', stars: 0 });
    assert.equal(el.dataset.filterUpdated, '2026-11-07T00:00:00Z');
    assert.equal(el.dataset.filterStars, '0');
  });

  it('writeStats ignores a missing element and missing fields', () => {
    assert.doesNotThrow(() => writeStats(null, { stars: 1 }));
    const el = fakeEl({ filterStars: '5' });
    writeStats(el, {});
    assert.equal(el.dataset.filterStars, '5');
  });
});

describe('buildFilterModel', () => {
  const src = (tags: string[], extra: Partial<FilterSource> = {}): FilterSource => ({
    title: 't',
    tags,
    ...extra,
  });

  it('returns null for empty lists, and for short lists unless forced', () => {
    assert.equal(buildFilterModel([]), null);
    assert.equal(buildFilterModel([], { force: true }), null);
    const short = Array.from({ length: MIN_FILTER_ITEMS - 1 }, () => src(['a']));
    assert.equal(buildFilterModel(short), null);
    assert.notEqual(buildFilterModel(short, { force: true }), null);
  });

  it('offers chips only for tags that distinguish items, most common first', () => {
    const model = buildFilterModel([
      src(['android-tv', 'browser']),
      src(['android-tv', 'media']),
      src(['android-tv', 'media', 'Browser']),
    ]);
    assert.equal(model?.total, 3);
    // android-tv is on every item so it is useless as a filter; browser/media are on 2 each.
    assert.deepEqual(model?.tags, ['browser', 'media']);
  });

  it('counts a tag once per item even if repeated', () => {
    const model = buildFilterModel([src(['a', 'a']), src(['b']), src(['b'])]);
    assert.deepEqual(model?.tags, ['b', 'a']);
  });

  it('only offers sorts the data supports', () => {
    const plain = buildFilterModel([src([]), src([]), src([])]);
    assert.deepEqual(plain?.sorts, ['default', 'title']);

    const dated = buildFilterModel([src([], { updated: '2026-01-01' }), src([]), src([])]);
    assert.deepEqual(dated?.sorts, ['default', 'title', 'updated']);

    const repo = buildFilterModel([src([], { repo: 'a/b' }), src([]), src([])]);
    assert.deepEqual(repo?.sorts, ['default', 'title', 'updated', 'stars']);
  });
});

describe('entrySource / pageSources', () => {
  it('derives the repo for GitHub entries', () => {
    const source = entrySource({
      title: 'Nuvio',
      description: 'd',
      href: 'https://github.com/NuvioMedia/NuvioTV',
      tags: ['media'],
    });
    assert.equal(source.repo, 'NuvioMedia/NuvioTV');
    assert.equal(source.title, 'Nuvio');
  });

  const base = { type: 'topic', slug: 's', title: 'T', description: 'D' } as const;

  it('collects children, links and entries but skips text blocks', () => {
    const page: TopicPage = {
      ...base,
      children: [{ ...base, title: 'Child', blocks: [] }],
      blocks: [
        { type: 'text', content: 'hello' },
        {
          type: 'links',
          title: 'L',
          items: [{ title: 'Link', description: 'd', href: 'x', label: 'lbl' }],
        },
        {
          type: 'entries',
          items: [{ title: 'Entry', description: 'd', href: 'https://example.com' }],
        },
        { type: 'steps', title: 'S', items: ['one'] },
      ],
    };
    assert.deepEqual(
      pageSources(page).map((s) => s.title),
      ['Child', 'Link', 'Entry'],
    );
  });

  it('offers nothing on hub pages', () => {
    const hub: TopicPage = {
      ...base,
      hub: true,
      blocks: [{ type: 'entries', items: [{ title: 'E', description: 'd', href: 'x' }] }],
    };
    assert.deepEqual(pageSources(hub), []);
  });
});
