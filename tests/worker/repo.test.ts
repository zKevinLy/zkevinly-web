import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleRepo } from '../../worker/repo.js';
import { clearRepoInfoMemo, fetchRepoInfoViaProxy } from '../../src/lib/github';

const req = (query: string, method = 'GET') =>
  new Request(`https://zkevinly.com/api/repo${query}`, { method });

const reply = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  json: async () => body,
});

describe('GET /api/repo', () => {
  let calls: { url: string; init?: RequestInit }[];

  function mockGitHub(ok = true) {
    calls = [];
    mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (!ok) return reply({}, false);
      return String(url).includes('/releases')
        ? reply([{ tag_name: 'v1.2.0', html_url: 'u', prerelease: false }])
        : reply({ pushed_at: '2026-11-07T00:00:00Z', stargazers_count: 7, private: true });
    });
  }

  beforeEach(() => {
    clearRepoInfoMemo();
    mock.method(console, 'warn', () => {});
  });
  afterEach(() => mock.restoreAll());

  it('returns repo info for a repo listed on the Projects page, using the Worker token', async () => {
    mockGitHub();
    const res = await handleRepo(req('?repo=zKevinLy/perkday'), { GITHUB_TOKEN: 'secret' });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      pushedAt: '2026-11-07T00:00:00Z',
      stars: 7,
      version: 'v1.2.0',
      releaseUrl: 'u',
      prerelease: false,
      private: true,
    });
    assert.ok(calls.length > 0);
    for (const call of calls) {
      assert.equal((call.init?.headers as Record<string, string>).Authorization, 'Bearer secret');
    }
  });

  it('matches the repo name case-insensitively but always asks GitHub with the configured casing', async () => {
    mockGitHub();
    const res = await handleRepo(req('?repo=ZKEVINLY/PERKDAY'), { GITHUB_TOKEN: 't' });
    assert.equal(res.status, 200);
    assert.ok(calls.every((c) => c.url.includes('/repos/zKevinLy/perkday')));
  });

  it('never talks to GitHub for repos that are not on the Projects page', async () => {
    mockGitHub();
    for (const q of ['?repo=zKevinLy/secret-thing', '?repo=', '', '?repo=../../user']) {
      const res = await handleRepo(req(q), { GITHUB_TOKEN: 't' });
      assert.equal(res.status, 404, q);
    }
    assert.equal(calls.length, 0);
  });

  it('only allows GET', async () => {
    mockGitHub();
    const res = await handleRepo(req('?repo=zKevinLy/perkday', 'POST'), { GITHUB_TOKEN: 't' });
    assert.equal(res.status, 405);
    assert.equal(calls.length, 0);
  });

  it('says 503 when the Worker has no token, without calling GitHub', async () => {
    mockGitHub();
    const res = await handleRepo(req('?repo=zKevinLy/perkday'), {});
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  });

  it('answers 502 and is never cached when GitHub refuses (expired token, rate limit)', async () => {
    mockGitHub(false);
    const res = await handleRepo(req('?repo=zKevinLy/perkday'), { GITHUB_TOKEN: 't' });
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });

  it('never puts the token in the response', async () => {
    mockGitHub();
    const res = await handleRepo(req('?repo=zKevinLy/perkday'), { GITHUB_TOKEN: 'hunter2-token' });
    assert.ok(!(await res.text()).includes('hunter2-token'));
    assert.ok(![...res.headers.values()].some((v) => v.includes('hunter2-token')));
  });
});

describe('fetchRepoInfoViaProxy', () => {
  afterEach(() => mock.restoreAll());

  const info = {
    pushedAt: '2026-11-07T00:00:00Z',
    stars: 7,
    version: 'v1.2.0',
    releaseUrl: 'u',
    prerelease: false,
    private: true,
  };

  it('calls the site\u2019s own /api/repo (no GitHub, no token) and returns valid info', async () => {
    const urls: string[] = [];
    mock.method(globalThis, 'fetch', async (url: string) => {
      urls.push(String(url));
      return { ok: true, json: async () => info } as Response;
    });
    assert.deepEqual(await fetchRepoInfoViaProxy('zKevinLy/perkday'), info);
    assert.deepEqual(urls, ['/api/repo?repo=zKevinLy%2Fperkday']);
  });

  it('returns null on errors, junk bodies and network failures', async () => {
    mock.method(globalThis, 'fetch', async () => ({ ok: false }) as Response);
    assert.equal(await fetchRepoInfoViaProxy('a/b'), null);
    mock.restoreAll();
    mock.method(
      globalThis,
      'fetch',
      async () => ({ ok: true, json: async () => ({}) }) as Response,
    );
    assert.equal(await fetchRepoInfoViaProxy('a/b'), null);
    mock.restoreAll();
    mock.method(globalThis, 'fetch', async () => {
      throw new Error('offline');
    });
    assert.equal(await fetchRepoInfoViaProxy('a/b'), null);
  });
});
