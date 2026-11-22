import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handlePing, workerPings } from '../../worker/ping.js';
import { handleRepo } from '../../worker/repo.js';
import { clearRepoInfoMemo } from '../../src/lib/github';
import type { DirectoryPage } from '../../src/config';

/** Cloudflare's `caches.default`, in memory. Keys are the request URLs. */
function installCache() {
  const store = new Map<string, Response>();
  const puts: { url: string; cacheControl: string | null }[] = [];
  const cache = {
    match: async (request: Request) => store.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => {
      puts.push({ url: request.url, cacheControl: response.headers.get('Cache-Control') });
      store.set(request.url, response);
    },
  };
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    writable: true,
    value: { default: cache },
  });
  return { store, puts };
}

const ping = (url: string) =>
  new Request(`https://zkevinly.com/api/ping?url=${encodeURIComponent(url)}`);
const repo = (name = 'zKevinLy/perkday') =>
  new Request(`https://zkevinly.com/api/repo?repo=${encodeURIComponent(name)}`);
const OK = 'https://app.example.com/';
const allowed = new Set([OK]);

/** A ctx that remembers what was handed to waitUntil, so a test can await it. */
const ctx = () => {
  const pending: Promise<unknown>[] = [];
  return { waitUntil: (p: Promise<unknown>) => void pending.push(p), pending };
};

afterEach(() => {
  mock.restoreAll();
  delete (globalThis as Record<string, unknown>).caches;
});

describe('which URLs the ping Worker may check', () => {
  const page = (...items: unknown[]) =>
    ({ type: 'directory', title: 'D', description: 'd', items }) as DirectoryPage;
  it('lists Worker pings and leaves browser pings out', () => {
    const pages = [
      page(
        { title: 'A', description: 'a', href: 'https://a.example.com/', ping: true },
        {
          title: 'B',
          description: 'b',
          href: 'https://b.example.com/',
          ping: { via: 'browser', url: 'http://nas.lab/' },
        },
        { title: 'C', description: 'c', href: 'https://c.example.com/' },
      ),
    ];
    assert.deepEqual([...workerPings(pages)], ['https://a.example.com/']);
  });
  it('is empty when nothing asks for one', () => {
    assert.equal(workerPings([]).size, 0);
  });
});

describe('/api/ping at the edge', () => {
  const reply = (status = 200) =>
    mock.method(globalThis, 'fetch', async () => new Response(null, { status }));

  it('answers from the edge cache without bothering the host', async () => {
    const { store } = installCache();
    const fetchMock = reply();
    store.set(
      `https://zkevinly.com/api/ping?url=${encodeURIComponent(OK)}`,
      Response.json({ up: true, ms: 9 }),
    );
    const res = await handlePing(ping(OK), {}, undefined, allowed);
    assert.deepEqual(await res.json(), { up: true, ms: 9 });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('on a miss checks the host and stores the answer, off the critical path when it can', async () => {
    const { puts } = installCache();
    reply();
    const c = ctx();
    const res = await handlePing(ping(OK), {}, c, allowed);
    assert.equal((await res.json()).up, true);
    assert.equal(c.pending.length, 1);
    await Promise.all(c.pending);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].cacheControl, 'public, max-age=30');
  });

  it('waits for the store itself when there is no ctx', async () => {
    const { puts } = installCache();
    reply();
    await handlePing(ping(OK), {}, undefined, allowed);
    assert.equal(puts.length, 1);
  });

  it('does not let a body that will not close take the check down', async () => {
    mock.method(globalThis, 'fetch', async () => ({
      status: 200,
      body: { cancel: () => Promise.reject(new Error('already closed')) },
    }));
    const res = await handlePing(ping(OK), {}, undefined, allowed);
    assert.equal((await res.json()).up, true);
  });

  it('answers 404 when the url parameter is missing altogether', async () => {
    const res = await handlePing(
      new Request('https://zkevinly.com/api/ping'),
      {},
      undefined,
      allowed,
    );
    assert.equal(res.status, 404);
  });
});

describe('/api/repo at the edge', () => {
  const github = (ok = true) =>
    mock.method(globalThis, 'fetch', async (url: string) => {
      if (!ok) return { ok: false, status: 500, json: async () => ({}) };
      return String(url).includes('/releases')
        ? {
            ok: true,
            status: 200,
            json: async () => [
              {
                tag_name: 'v1',
                html_url: 'https://github.com/zKevinLy/perkday/releases/tag/v1',
                prerelease: false,
              },
            ],
          }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              pushed_at: '2026-11-07T00:00:00Z',
              stargazers_count: 3,
              private: true,
            }),
          };
    });
  const env = { GITHUB_TOKEN: 't' };
  const KEY = `https://zkevinly.com/api/repo?repo=${encodeURIComponent('zKevinLy/perkday')}`;

  beforeEach(() => {
    clearRepoInfoMemo();
    mock.method(console, 'warn', () => {});
  });

  it('serves a cached answer without asking GitHub', async () => {
    const { store } = installCache();
    const fetchMock = github();
    store.set(KEY, Response.json({ cached: true }));
    const res = await handleRepo(repo(), env);
    assert.deepEqual(await res.json(), { cached: true });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('stores a good answer for the edge (longer than the browser keeps it)', async () => {
    const { puts } = installCache();
    github();
    const c = ctx();
    const res = await handleRepo(repo(), env, c);
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=300');
    await Promise.all(c.pending);
    assert.deepEqual(
      puts.map((p) => [p.url, p.cacheControl]),
      [[KEY, 'public, max-age=600']],
    );
  });

  it('waits for the store itself when there is no ctx', async () => {
    const { puts } = installCache();
    github();
    await handleRepo(repo(), env);
    assert.equal(puts.length, 1);
  });

  it('remembers a failure briefly, so an outage cannot burn the token’s rate limit', async () => {
    const { puts } = installCache();
    const fetchMock = github(false);
    const c = ctx();
    const first = await handleRepo(repo(), env, c);
    assert.equal(first.status, 502);
    await Promise.all(c.pending);
    assert.equal(puts.length, 1);
    assert.match(puts[0].url, /&failed=1$/);
    assert.equal(puts[0].cacheControl, 'public, max-age=30');
    const calls = fetchMock.mock.callCount();
    const second = await handleRepo(repo(), env, c);
    assert.equal(second.status, 502);
    assert.equal(fetchMock.mock.callCount(), calls, 'the second request never reached GitHub');
  });

  it('waits for the failure note itself when there is no ctx', async () => {
    const { puts } = installCache();
    github(false);
    await handleRepo(repo(), env);
    assert.equal(puts.length, 1);
  });
});
