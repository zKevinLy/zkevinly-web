import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGifUrl,
  normalizeQuery,
  normalizeRating,
  parseKeys,
  searchGifs,
  searchGifsWithKeys,
  shuffle,
} from '../../worker/giphy.js';

const gif = (url: string, title = 't') => ({ title, images: { fixed_width: { url } } });
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

afterEach(() => mock.restoreAll());

describe('normalizeQuery', () => {
  it('trims, lower-cases, collapses whitespace and drops control characters', () => {
    assert.equal(normalizeQuery('  Hello\t\nWORLD\u0000  x '), 'hello world x');
  });
  it('caps the length at 80 characters', () => {
    assert.equal(normalizeQuery('a'.repeat(500)).length, 80);
  });
  it('turns null, undefined and non-strings into an empty query', () => {
    assert.equal(normalizeQuery(null), '');
    assert.equal(normalizeQuery(undefined), '');
    assert.equal(normalizeQuery(42), '42');
  });
});

describe('normalizeRating', () => {
  it('accepts the four GIPHY ratings in any case', () => {
    for (const r of ['g', 'PG', ' pg-13 ', 'R'])
      assert.equal(normalizeRating(r), r.trim().toLowerCase());
  });
  it('falls back to pg', () => {
    for (const r of [undefined, '', 'x', 'nc-17', 'pg;drop'])
      assert.equal(normalizeRating(r), 'pg');
  });
});

describe('extractGifUrl', () => {
  it('prefers the small rendition', () => {
    const item = {
      images: {
        original: { url: 'https://media.giphy.com/o.gif' },
        fixed_width: { url: 'https://media0.giphy.com/s.gif' },
      },
    };
    assert.equal(extractGifUrl(item), 'https://media0.giphy.com/s.gif');
  });
  it('falls back to bigger renditions', () => {
    assert.equal(
      extractGifUrl({ images: { original: { url: 'https://i.giphy.com/o.gif' } } }),
      'https://i.giphy.com/o.gif',
    );
  });
  it('never hands out a non-https or non-GIPHY URL', () => {
    for (const url of [
      'http://media.giphy.com/a.gif',
      'https://evil.example/a.gif',
      'https://giphy.com.evil.example/a.gif',
      'https://notgiphy.com/a.gif',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//media.giphy.com/a.gif',
      42,
      null,
    ]) {
      assert.equal(extractGifUrl({ images: { fixed_width: { url } } }), null, String(url));
    }
  });
  it('skips a bad rendition and uses the next good one', () => {
    const item = {
      images: {
        fixed_width: { url: 'https://evil.example/a.gif' },
        fixed_height: { url: 'https://media.giphy.com/b.gif' },
      },
    };
    assert.equal(extractGifUrl(item), 'https://media.giphy.com/b.gif');
  });
  it('copes with junk items', () => {
    for (const item of [null, undefined, {}, { images: null }, { images: 'x' }]) {
      assert.equal(extractGifUrl(item), null);
    }
  });
});

describe('parseKeys', () => {
  it('splits on commas, spaces and newlines, drops blanks and duplicates', () => {
    assert.deepEqual(parseKeys('a, b\nc  a', undefined, 'd,,'), ['a', 'b', 'c', 'd']);
  });
  it('is empty when nothing is set', () => {
    assert.deepEqual(parseKeys(undefined, ''), []);
  });
});

describe('shuffle', () => {
  it('returns every item once without touching the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    assert.deepEqual([...out].sort(), input);
    assert.deepEqual(input, [1, 2, 3, 4, 5]);
  });
  it('is deterministic for a given rng', () => {
    assert.deepEqual(
      shuffle([1, 2, 3], () => 0),
      [2, 3, 1],
    );
  });
});

describe('searchGifs', () => {
  it('sends the query, rating and key, and returns only safe GIFs', async () => {
    let seen = '';
    const fetchImpl = async (url: string) => {
      seen = url;
      return ok([gif('https://media.giphy.com/a.gif', 'A'), gif('https://evil.example/b.gif')]);
    };
    const out = await searchGifs({
      query: 'cat',
      key: 'K',
      rating: 'R',
      fetchImpl: fetchImpl as never,
    });
    assert.deepEqual(out, [{ url: 'https://media.giphy.com/a.gif', title: 'A' }]);
    const params = new URL(seen).searchParams;
    assert.equal(params.get('q'), 'cat');
    assert.equal(params.get('api_key'), 'K');
    assert.equal(params.get('rating'), 'r');
  });
  it('uses the query as the title when GIPHY sends none, and honours the limit', async () => {
    const data = Array.from({ length: 10 }, (_, i) => gif(`https://media.giphy.com/${i}.gif`, ''));
    const out = await searchGifs({
      query: 'dog',
      key: 'K',
      limit: 3,
      fetchImpl: (async () => ok(data)) as never,
    });
    assert.equal(out.length, 3);
    assert.equal(out[0].title, 'dog');
  });
  it('throws with the status, without leaking the body', async () => {
    await assert.rejects(
      searchGifs({ query: 'x', key: 'K', fetchImpl: (async () => fail(429)) as never }),
      (e: { status?: number; message: string }) => e.status === 429 && !/K/.test(e.message),
    );
  });
  it('rejects an unexpected response shape', async () => {
    await assert.rejects(
      searchGifs({
        query: 'x',
        key: 'K',
        fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as never,
      }),
      /Unexpected/,
    );
  });
});

describe('searchGifsWithKeys', () => {
  const good = ok([gif('https://media.giphy.com/a.gif')]);

  it('moves to the next key only when GIPHY rejects the key', async () => {
    for (const status of [401, 403, 429]) {
      const used: string[] = [];
      const fetchImpl = async (url: string) => {
        const key = new URL(url).searchParams.get('api_key')!;
        used.push(key);
        return key === 'bad' ? fail(status) : good;
      };
      const out = await searchGifsWithKeys({
        keys: ['bad', 'good'],
        rng: () => 0.99,
        query: 'x',
        fetchImpl: fetchImpl as never,
      });
      assert.equal(out.length, 1, String(status));
      assert.ok(used.includes('good'));
    }
  });
  it('does not burn through keys on an outage', async () => {
    let calls = 0;
    const fetchImpl = async () => (calls++, fail(500));
    await assert.rejects(
      searchGifsWithKeys({ keys: ['a', 'b', 'c'], query: 'x', fetchImpl: fetchImpl as never }),
    );
    assert.equal(calls, 1);
  });
  it('throws the last error when every key is rejected', async () => {
    await assert.rejects(
      searchGifsWithKeys({
        keys: ['a', 'b'],
        query: 'x',
        fetchImpl: (async () => fail(403)) as never,
      }),
      (e: { status?: number }) => e.status === 403,
    );
  });
  it('fails clearly with no keys', async () => {
    await assert.rejects(searchGifsWithKeys({ keys: [], query: 'x' }), /No GIPHY API key/);
  });
});
