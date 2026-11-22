import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleGif } from '../../worker/gif.js';

const req = (query: string, init: RequestInit = {}) =>
  new Request(`https://zkevinly.com/api/gif${query}`, init);
const giphy = (...urls: string[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: urls.map((url) => ({ title: 'g', images: { fixed_width: { url } } })),
  }),
});

afterEach(() => mock.restoreAll());

describe('GET /api/gif', () => {
  it('only answers GET', async () => {
    assert.equal(
      (await handleGif(req('?q=hi', { method: 'POST' }), { GIPHY_API_KEYS: 'k' })).status,
      405,
    );
  });

  it('rejects an empty or missing query without calling GIPHY', async () => {
    const f = mock.method(globalThis, 'fetch', async () => giphy());
    for (const q of ['', '?q=', '?q=%20%09', '?q=%00']) {
      assert.equal((await handleGif(req(q), { GIPHY_API_KEYS: 'k' })).status, 400, q);
    }
    assert.equal(f.mock.callCount(), 0);
  });

  it('says 503 when no key is configured', async () => {
    assert.equal((await handleGif(req('?q=hi'), {})).status, 503);
  });

  it('returns GIFs, forwards only the normalised query, and is never cached', async () => {
    let url = '';
    let init: RequestInit | undefined;
    mock.method(globalThis, 'fetch', async (u: string, i?: RequestInit) => {
      url = String(u);
      init = i;
      return giphy('https://media.giphy.com/a.gif');
    });
    const res = await handleGif(
      req('?q=%20Hello%20%20WORLD', {
        headers: { Cookie: 'a=b', 'CF-Connecting-IP': '203.0.113.9' },
      }),
      { GIPHY_API_KEYS: 'k1', GIPHY_RATING: 'g' },
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      gifs: [{ url: 'https://media.giphy.com/a.gif', title: 'g' }],
    });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.equal(new URL(url).searchParams.get('q'), 'hello world');
    assert.equal(new URL(url).searchParams.get('rating'), 'g');
    // Privacy: no cookies, no visitor IP, nothing but an Accept header goes to GIPHY.
    assert.deepEqual(Object.keys(init!.headers as object), ['Accept']);
    assert.ok(!url.includes('203.0.113.9'));
  });

  it('answers 502 when GIPHY fails', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    assert.equal((await handleGif(req('?q=hi'), { GIPHY_API_KEYS: 'k' })).status, 502);
  });

  it('API responses carry hardening headers', async () => {
    const res = await handleGif(req('?q=hi'), {});
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(
      res.headers.get('Content-Security-Policy'),
      "default-src 'none'; frame-ancestors 'none'",
    );
    assert.equal(res.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  });

  describe('rate limit', () => {
    it('answers 429 with Retry-After and never reaches GIPHY', async () => {
      const f = mock.method(globalThis, 'fetch', async () => giphy());
      const keys: string[] = [];
      const GIF_LIMITER = {
        limit: async ({ key }: { key: string }) => (keys.push(key), { success: false }),
      };
      const res = await handleGif(
        req('?q=hi', { headers: { 'CF-Connecting-IP': '198.51.100.7' } }),
        {
          GIPHY_API_KEYS: 'k',
          GIF_LIMITER,
        },
      );
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('Retry-After'), '60');
      assert.deepEqual(keys, ['198.51.100.7']);
      assert.equal(f.mock.callCount(), 0);
    });

    it('lets requests through while under the limit', async () => {
      mock.method(globalThis, 'fetch', async () => giphy('https://media.giphy.com/a.gif'));
      const GIF_LIMITER = { limit: async () => ({ success: true }) };
      assert.equal(
        (await handleGif(req('?q=hi'), { GIPHY_API_KEYS: 'k', GIF_LIMITER })).status,
        200,
      );
    });

    it('fails open if the limiter itself errors', async () => {
      mock.method(globalThis, 'fetch', async () => giphy('https://media.giphy.com/a.gif'));
      const GIF_LIMITER = {
        limit: async () => {
          throw new Error('down');
        },
      };
      assert.equal(
        (await handleGif(req('?q=hi'), { GIPHY_API_KEYS: 'k', GIF_LIMITER })).status,
        200,
      );
    });

    it('does not spend a limiter hit on a bad request', async () => {
      let hits = 0;
      const GIF_LIMITER = { limit: async () => (hits++, { success: true }) };
      await handleGif(req('?q='), { GIPHY_API_KEYS: 'k', GIF_LIMITER });
      assert.equal(hits, 0);
    });
  });
});
