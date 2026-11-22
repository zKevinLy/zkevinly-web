import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handlePing } from '../../worker/ping.js';

const OK = 'https://app.example.com/';
const allowed = new Set([OK]);

const req = (query: string, method = 'GET') =>
  new Request(`https://zkevinly.com/api/ping${query}`, { method });
const ask = (url: string) => req(`?url=${encodeURIComponent(url)}`);

type Seen = { url: string; method?: string; init?: RequestInit };

describe('GET /api/ping', () => {
  let seen: Seen[];

  /** Replies to each call with the next status in the list (the last one repeats). A string throws. */
  function mockHost(...replies: (number | string)[]) {
    seen = [];
    mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method, init });
      const next = replies[Math.min(seen.length - 1, replies.length - 1)];
      if (typeof next === 'string') throw new Error(next);
      return new Response(null, { status: next });
    });
  }

  afterEach(() => mock.restoreAll());

  it('reports a host that answers as up, with the time it took', async () => {
    mockHost(200);
    const res = await handlePing(ask(OK), {}, undefined, allowed);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.up, true);
    assert.equal(body.status, 200);
    assert.equal(typeof body.ms, 'number');
    assert.deepEqual(
      seen.map((s) => [s.url, s.method]),
      [[OK, 'HEAD']],
    );
  });

  it('does not follow redirects, and treats 3xx and 4xx as up (the host is there)', async () => {
    for (const status of [301, 401, 403, 404]) {
      mockHost(status);
      const body = await (await handlePing(ask(OK), {}, undefined, allowed)).json();
      assert.equal(body.up, true, String(status));
      assert.equal(seen[0].init?.redirect, 'manual');
    }
  });

  it('treats 5xx as down', async () => {
    for (const status of [500, 502, 530]) {
      mockHost(status);
      const body = await (await handlePing(ask(OK), {}, undefined, allowed)).json();
      assert.equal(body.up, false, String(status));
      assert.equal(body.status, status);
    }
  });

  it('retries once with GET when the host refuses HEAD', async () => {
    mockHost(405, 200);
    const body = await (await handlePing(ask(OK), {}, undefined, allowed)).json();
    assert.equal(body.up, true);
    assert.deepEqual(
      seen.map((s) => s.method),
      ['HEAD', 'GET'],
    );
  });

  it('reports down, without a time, when the request fails or times out', async () => {
    mockHost('connection refused');
    const res = await handlePing(ask(OK), {}, undefined, allowed);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { up: false });
  });

  it('only checks URLs the config lists; everything else is 404 and never requested', async () => {
    mockHost(200);
    for (const q of [
      `?url=${encodeURIComponent('https://evil.example.com/')}`,
      `?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}`,
      `?url=${encodeURIComponent('https://app.example.com/other')}`,
      '?url=',
      '?url=not-a-url',
      '',
    ]) {
      const res = await handlePing(req(q), {}, undefined, allowed);
      assert.equal(res.status, 404, q);
    }
    assert.equal(seen.length, 0);
  });

  it('ignores the #fragment when matching', async () => {
    mockHost(200);
    const res = await handlePing(ask(`${OK}#x`), {}, undefined, allowed);
    assert.equal(res.status, 200);
    assert.equal(seen[0].url, OK);
  });

  it('uses the site config\u2019s own list by default: an unlisted URL is never requested', async () => {
    mockHost(200);
    const res = await handlePing(ask('https://not-in-the-config.example.com/'));
    assert.equal(res.status, 404);
    assert.equal(seen.length, 0);
  });

  it('only allows GET', async () => {
    mockHost(200);
    const res = await handlePing(
      req(`?url=${encodeURIComponent(OK)}`, 'POST'),
      {},
      undefined,
      allowed,
    );
    assert.equal(res.status, 405);
    assert.equal(seen.length, 0);
  });

  it('lets browsers keep an answer briefly, and sends a user agent but nothing from the visitor', async () => {
    mockHost(200);
    const res = await handlePing(ask(OK), {}, undefined, allowed);
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=30');
    const headers = seen[0].init?.headers as Record<string, string>;
    assert.match(headers['User-Agent'], /zkevinly-ping/);
    assert.deepEqual(Object.keys(headers), ['User-Agent']);
  });
});
