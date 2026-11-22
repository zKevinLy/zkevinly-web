import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { clearRepoInfoMemo, fetchRepoInfo } from '../../src/lib/github';

type Reply = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  body?: unknown;
};
const respond = ({ ok, status, headers, body }: Reply) => ({
  ok,
  status,
  headers,
  json: async () => body ?? {},
});
const bad = (status: number, remaining?: string): Reply => ({
  ok: false,
  status,
  headers: { get: (name) => (name === 'x-ratelimit-remaining' ? (remaining ?? null) : null) },
});

let warnings: string[];
beforeEach(() => {
  clearRepoInfoMemo();
  warnings = [];
  mock.method(console, 'warn', (...args: unknown[]) => void warnings.push(String(args[0])));
});
afterEach(() => mock.restoreAll());

/** Every request gets `reply`, or `route(url)` when given. */
const network = (reply: Reply | ((url: string) => Reply | Error)) =>
  mock.method(globalThis, 'fetch', async (url: string) => {
    const r = typeof reply === 'function' ? reply(String(url)) : reply;
    if (r instanceof Error) throw r;
    return respond(r);
  });

describe('explaining why GitHub refused', () => {
  const cases: [string, Reply, RegExp][] = [
    ['not found', bad(404), /token cannot read this repo/],
    ['a bad token', bad(401), /bad or expired token/],
    ['the rate limit', bad(403, '0'), /rate limit reached; set GITHUB_TOKEN/],
    ['forbidden without a spent limit', bad(403, '12'), /forbidden or rate limited/],
    ['too many requests', bad(429), /forbidden or rate limited/],
    ['a server error', bad(500), /HTTP 500$/],
  ];
  for (const [name, reply, expected] of cases) {
    it(`says so for ${name}`, async () => {
      network(reply);
      assert.equal(await fetchRepoInfo(`o/${name.replace(/\W/g, '-')}`, 'token'), null);
      assert.match(warnings[0], expected);
      assert.match(warnings[0], /^\[github] /);
    });
  }

  it('copes with a response that has no headers at all', async () => {
    network({ ok: false, status: 403 });
    assert.equal(await fetchRepoInfo('o/no-headers'), null);
    assert.match(warnings[0], /forbidden or rate limited/);
  });
});

describe('explaining why GitLab refused', () => {
  const cases: [number, RegExp][] = [
    [404, /not found, or not a public project/],
    [403, /rate limited or forbidden/],
    [429, /rate limited or forbidden/],
    [500, /HTTP 500$/],
  ];
  for (const [status, expected] of cases) {
    it(`says so for HTTP ${status}`, async () => {
      network(bad(status));
      assert.equal(await fetchRepoInfo(`gitlab:g/p${status}`), null);
      assert.match(warnings[0], expected);
      assert.match(warnings[0], /^\[gitlab] /);
    });
  }

  it('blames the releases list when the project itself was fine', async () => {
    network((url) =>
      url.includes('/releases')
        ? bad(500)
        : {
            ok: true,
            status: 200,
            body: { last_activity_at: '2026-01-01T00:00:00Z', star_count: 1 },
          },
    );
    assert.equal(await fetchRepoInfo('gitlab:g/releases-fail'), null);
    assert.match(warnings[0], /HTTP 500$/);
  });

  it('counts a project with no star_count as having none', async () => {
    network((url) =>
      url.includes('/releases')
        ? { ok: true, status: 200, body: [] }
        : { ok: true, status: 200, body: { last_activity_at: '2026-01-01T00:00:00Z' } },
    );
    assert.equal((await fetchRepoInfo('gitlab:g/no-stars'))?.stars, 0);
  });

  it('returns nothing, with a warning, when the request itself blows up', async () => {
    network(() => new Error('offline'));
    assert.equal(await fetchRepoInfo('gitlab:g/offline'), null);
    assert.match(warnings[0], /request failed/);
  });
});
