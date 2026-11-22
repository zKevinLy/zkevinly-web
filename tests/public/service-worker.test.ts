import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../../public/toolkit/pdf-preview-sw.js', import.meta.url),
  'utf8',
);
const ORIGIN = 'https://zkevinly.com';
const ID = 'abcdef12-tab';

type Listener = (event: Record<string, unknown>) => void;

function boot(now = { t: 1_000_000 }) {
  const listeners: Record<string, Listener> = {};
  const self = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    location: { origin: ORIGIN },
  };
  const FakeDate = class extends Date {
    static now() {
      return now.t;
    }
  };
  vm.runInNewContext(
    source,
    { self, URL, Response, Date: FakeDate, Number, Map, ArrayBuffer },
    { filename: 'sw.js' },
  );

  const post = (data: unknown) => {
    const replies: unknown[] = [];
    listeners.message({ data, ports: [{ postMessage: (m: unknown) => replies.push(m) }] });
    return replies;
  };
  const get = async (path: string, origin = ORIGIN) => {
    let out: Response | undefined;
    listeners.fetch({
      request: { url: `${origin}${path}` },
      respondWith: (r: Response | Promise<Response>) => {
        out = r as Response;
      },
    });
    return out === undefined ? undefined : out;
  };
  return { post, get, now };
}

const bytes = (n = 8) => new Uint8Array(n).fill(37).buffer;
const path = (id: string, v: number) => `/toolkit/pdf/preview/doc.pdf?id=${id}&v=${v}`;

describe('PDF preview service worker', () => {
  let sw: ReturnType<typeof boot>;
  beforeEach(() => {
    sw = boot();
  });

  it('serves stored bytes as an inline, uncached, non-sniffable PDF', async () => {
    assert.deepEqual(sw.post({ id: ID, v: 1, bytes: bytes() }), ['ok']);
    const res = (await sw.get(path(ID, 1)))!;
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/pdf');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal((await res.arrayBuffer()).byteLength, 8);
  });

  it('answers 404 for unknown ids, versions, and other tabs', async () => {
    sw.post({ id: ID, v: 1, bytes: bytes() });
    assert.equal((await sw.get(path(ID, 2)))!.status, 404);
    assert.equal((await sw.get(path('zzzzzzzz-other', 1)))!.status, 404);
    assert.equal((await sw.get('/toolkit/pdf/preview/doc.pdf'))!.status, 404);
  });

  it('ignores requests it does not own', async () => {
    assert.equal(await sw.get('/about'), undefined);
    assert.equal(await sw.get(path(ID, 1), 'https://evil.example'), undefined);
  });

  it('rejects malformed messages', () => {
    for (const data of [
      null,
      {},
      { id: 'short', v: 1, bytes: bytes() },
      { id: 'UPPER-CASE-ID', v: 1, bytes: bytes() },
      { id: `${'a'.repeat(65)}`, v: 1, bytes: bytes() },
      { id: ID, v: '1', bytes: bytes() },
      { id: ID, v: 1, bytes: 'nope' },
      { id: ID, v: 1 },
      { id: 42, v: 1, bytes: bytes() },
    ]) {
      assert.deepEqual(sw.post(data), [], JSON.stringify(data));
    }
  });

  it('keeps only the last few versions per tab', async () => {
    for (let v = 1; v <= 6; v++) sw.post({ id: ID, v, bytes: bytes() });
    assert.equal((await sw.get(path(ID, 1)))!.status, 404);
    assert.equal((await sw.get(path(ID, 3)))!.status, 404);
    assert.equal((await sw.get(path(ID, 4)))!.status, 200);
    assert.equal((await sw.get(path(ID, 6)))!.status, 200);
  });

  it('drops everything for a tab on clear, and leaves other tabs alone', async () => {
    sw.post({ id: ID, v: 1, bytes: bytes() });
    sw.post({ id: 'second-tab-id', v: 1, bytes: bytes() });
    sw.post({ id: ID, clear: true });
    assert.equal((await sw.get(path(ID, 1)))!.status, 404);
    assert.equal((await sw.get(path('second-tab-id', 1)))!.status, 200);
  });

  it('forgets previews after ten minutes', async () => {
    sw.post({ id: ID, v: 1, bytes: bytes() });
    sw.now.t += 10 * 60 * 1000 + 1;
    assert.equal((await sw.get(path(ID, 1)))!.status, 404);
  });
});
