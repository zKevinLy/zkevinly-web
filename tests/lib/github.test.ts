import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_VERSION,
  cacheKey,
  clearRepoInfoMemo,
  entryRepo,
  fetchRepoInfo,
  freshness,
  isRepoInfo,
  parseRepo,
  pickRelease,
  readCachedInfo,
  readStaleInfo,
  relativeTime,
  type RepoInfo,
} from '../../src/lib/github';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-07T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('parseRepo', () => {
  it('extracts owner/name from github.com URLs', () => {
    assert.equal(parseRepo('https://github.com/NuvioMedia/NuvioTV'), 'NuvioMedia/NuvioTV');
    assert.equal(parseRepo('https://github.com/truefedex/tv-bro/issues/1'), 'truefedex/tv-bro');
    assert.equal(parseRepo('https://github.com/owner/repo.git'), 'owner/repo');
  });

  it('rejects other hosts, incomplete paths and garbage', () => {
    assert.equal(parseRepo('https://gitlab.com/owner/repo'), null);
    assert.equal(parseRepo('https://github.com/owner'), null);
    assert.equal(parseRepo('https://github.com/'), null);
    assert.equal(parseRepo('not a url'), null);
  });
});

describe('entryRepo', () => {
  const href = 'https://github.com/a/b';
  it('infers the repo from href', () => assert.equal(entryRepo({ href }), 'a/b'));
  it('prefers an explicit repo', () => assert.equal(entryRepo({ href, repo: 'c/d' }), 'c/d'));
  it('can be disabled with false', () => assert.equal(entryRepo({ href, repo: false }), null));
  it('is null for non-GitHub links', () =>
    assert.equal(entryRepo({ href: 'https://example.com' }), null));
});

describe('pickRelease', () => {
  const beta = { tag_name: '1.1.0-beta.11', html_url: 'u/beta', prerelease: true };
  const stable = { tag_name: '1.0.0', html_url: 'u/stable', prerelease: false };

  it('includes pre-releases (repos that only ship betas still get a tag)', () => {
    assert.equal(pickRelease([beta])?.tag_name, '1.1.0-beta.11');
  });

  it('takes the first (newest) published release, pre-release or not', () => {
    assert.equal(pickRelease([beta, stable])?.tag_name, '1.1.0-beta.11');
    assert.equal(pickRelease([stable, beta])?.tag_name, '1.0.0');
  });

  it('skips drafts and entries without a tag', () => {
    assert.equal(pickRelease([{ ...beta, draft: true }, stable])?.tag_name, '1.0.0');
    assert.equal(pickRelease([{ html_url: 'x' }, null, stable])?.tag_name, '1.0.0');
  });

  it('returns null when there is nothing to show', () => {
    assert.equal(pickRelease([]), null);
    assert.equal(pickRelease([{ ...beta, draft: true }]), null);
    assert.equal(pickRelease({ message: 'Not Found' }), null);
    assert.equal(pickRelease(undefined), null);
  });
});

describe('isRepoInfo / readCachedInfo / cacheKey', () => {
  const info: RepoInfo = {
    pushedAt: '2026-11-07T00:00:00Z',
    stars: 3396,
    version: '1.1.0-beta.11',
    releaseUrl: 'https://github.com/NuvioMedia/NuvioTV/releases/tag/1.1.0-beta.11',
    prerelease: true,
    private: false,
  };
  const TTL = 60 * 60 * 1000;
  const blob = (t: number, value: unknown = info) => JSON.stringify({ t, info: value });

  it('accepts well-formed info, including "no release"', () => {
    assert.equal(isRepoInfo(info), true);
    assert.equal(isRepoInfo({ ...info, version: null, releaseUrl: null, prerelease: false }), true);
  });

  it('rejects release links that are not https://github.com URLs', () => {
    assert.equal(isRepoInfo({ ...info, releaseUrl: 'javascript:alert(1)' }), false);
    assert.equal(isRepoInfo({ ...info, releaseUrl: 'https://evil.example/x' }), false);
  });

  it('rejects wrong shapes', () => {
    assert.equal(isRepoInfo(null), false);
    assert.equal(isRepoInfo('x'), false);
    assert.equal(isRepoInfo({ ...info, stars: '1' }), false);
    assert.equal(isRepoInfo({ ...info, version: 1 }), false);
    assert.equal(isRepoInfo({ ...info, private: undefined }), false);
  });

  it('returns fresh cached info', () => {
    assert.deepEqual(readCachedInfo(blob(NOW - 1000), TTL, NOW), info);
  });

  it('ignores expired entries', () => {
    assert.equal(readCachedInfo(blob(NOW - TTL), TTL, NOW), null);
    assert.equal(readCachedInfo(blob(NOW - 2 * TTL), TTL, NOW), null);
  });

  it('ignores entries written by an older version of the site (no `prerelease` field)', () => {
    // This is the stale-cache case that kept Nuvio's tag hidden: info cached as
    // "no release" before pre-releases were supported.
    const legacy: Partial<RepoInfo> = { ...info, version: null, releaseUrl: null };
    delete legacy.prerelease;
    assert.equal(readCachedInfo(blob(NOW - 1000, legacy), TTL, NOW), null);
  });

  it('ignores missing or corrupt data', () => {
    assert.equal(readCachedInfo(null, TTL, NOW), null);
    assert.equal(readCachedInfo('', TTL, NOW), null);
    assert.equal(readCachedInfo('{not json', TTL, NOW), null);
    assert.equal(readCachedInfo(JSON.stringify({ info }), TTL, NOW), null);
  });

  it('readStaleInfo returns expired data (fallback when a refetch fails) but still rejects junk', () => {
    assert.deepEqual(readStaleInfo(blob(NOW - 100 * TTL)), info);
    assert.equal(readStaleInfo(blob(NOW, { ...info, prerelease: undefined })), null);
    assert.equal(readStaleInfo(null), null);
    assert.equal(readStaleInfo('{nope'), null);
  });

  it('versions the cache key so old entries are never read', () => {
    assert.equal(cacheKey('a/b'), `gh:v${CACHE_VERSION}:a/b`);
    assert.notEqual(cacheKey('a/b'), 'gh:a/b');
  });
});

describe('relativeTime', () => {
  it('says "just now" under a minute (past or future)', () => {
    assert.equal(relativeTime(ago(30_000), NOW), 'just now');
    assert.equal(relativeTime(ago(-30_000), NOW), 'just now');
  });

  it('formats minutes, hours, days, weeks, months, years', () => {
    assert.equal(relativeTime(ago(5 * 60_000), NOW), '5 minutes ago');
    assert.equal(relativeTime(ago(11 * 3_600_000), NOW), '11 hours ago');
    assert.equal(relativeTime(ago(DAY), NOW), 'yesterday');
    assert.equal(relativeTime(ago(4 * DAY), NOW), '4 days ago');
    assert.equal(relativeTime(ago(14 * DAY), NOW), '2 weeks ago');
    assert.equal(relativeTime(ago(60 * DAY), NOW), '2 months ago');
    assert.equal(relativeTime(ago(400 * DAY), NOW), 'last year');
  });

  it('handles the future', () => {
    assert.equal(relativeTime(ago(-2 * 3_600_000), NOW), 'in 2 hours');
  });
});

describe('freshness', () => {
  it('is hot within 14 days, warm within 90, otherwise cold', () => {
    assert.equal(freshness(ago(0), NOW), 'hot');
    assert.equal(freshness(ago(14 * DAY), NOW), 'hot');
    assert.equal(freshness(ago(15 * DAY), NOW), 'warm');
    assert.equal(freshness(ago(90 * DAY), NOW), 'warm');
    assert.equal(freshness(ago(91 * DAY), NOW), 'cold');
  });
});

describe('fetchRepoInfo', () => {
  type Reply = { ok?: boolean; status?: number; body: unknown };
  const reply = ({ ok = true, status, body }: Reply) =>
    ({ ok, status, json: async () => body }) as Response;

  /** Routes the two GitHub calls to canned replies and records every request. */
  function mockGitHub(repo: Reply, releases: Reply) {
    const calls: { url: string; init?: RequestInit }[] = [];
    mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return String(url).includes('/releases') ? reply(releases) : reply(repo);
    });
    return calls;
  }

  const repoBody = { pushed_at: '2026-11-07T00:00:00Z', stargazers_count: 3396 };

  beforeEach(() => {
    clearRepoInfoMemo();
    mock.method(console, 'warn', () => {});
  });
  afterEach(() => mock.restoreAll());

  it('REGRESSION: shows the tag for a repo whose releases are all pre-releases (Nuvio)', async () => {
    mockGitHub(
      { body: repoBody },
      {
        body: [
          {
            tag_name: '1.1.0-beta.11',
            html_url: 'https://github.com/NuvioMedia/NuvioTV/releases/tag/1.1.0-beta.11',
            prerelease: true,
            draft: false,
          },
          { tag_name: '1.1.0-beta.10', html_url: 'u', prerelease: true, draft: false },
        ],
      },
    );

    const info = await fetchRepoInfo('NuvioMedia/NuvioTV');
    assert.deepEqual(info, {
      pushedAt: '2026-11-07T00:00:00Z',
      stars: 3396,
      version: '1.1.0-beta.11',
      releaseUrl: 'https://github.com/NuvioMedia/NuvioTV/releases/tag/1.1.0-beta.11',
      prerelease: true,
      private: false,
    });
  });

  it('flags private repos so the browser skips refreshing them', async () => {
    mockGitHub({ body: { ...repoBody, private: true } }, { body: [] });
    assert.equal((await fetchRepoInfo('a/private'))?.private, true);
    mockGitHub({ body: repoBody }, { body: [] });
    assert.equal((await fetchRepoInfo('a/public'))?.private, false);
  });

  it('flags stable releases as not pre-release', async () => {
    mockGitHub(
      { body: repoBody },
      { body: [{ tag_name: 'v2.1.6', html_url: 'u', prerelease: false }] },
    );
    const info = await fetchRepoInfo('truefedex/tv-bro');
    assert.equal(info?.version, 'v2.1.6');
    assert.equal(info?.prerelease, false);
  });

  it('skips drafts', async () => {
    mockGitHub(
      { body: repoBody },
      {
        body: [
          { tag_name: 'draft', html_url: 'd', draft: true },
          { tag_name: 'v1', html_url: 'u' },
        ],
      },
    );
    assert.equal((await fetchRepoInfo('a/b'))?.version, 'v1');
  });

  it('returns version: null for a repo with no releases', async () => {
    mockGitHub({ body: repoBody }, { body: [] });
    const info = await fetchRepoInfo('a/b');
    assert.equal(info?.version, null);
    assert.equal(info?.releaseUrl, null);
    assert.equal(info?.prerelease, false);
  });

  it('defaults stars to 0', async () => {
    mockGitHub({ body: { pushed_at: '2026-01-01T00:00:00Z' } }, { body: [] });
    assert.equal((await fetchRepoInfo('a/b'))?.stars, 0);
  });

  it('returns null when either call fails (rate limit), so nothing half-empty gets cached', async () => {
    mockGitHub({ body: repoBody }, { ok: false, body: { message: 'rate limited' } });
    assert.equal(await fetchRepoInfo('a/b'), null);
    mock.restoreAll();
    mockGitHub({ ok: false, body: {} }, { body: [] });
    assert.equal(await fetchRepoInfo('a/b'), null);
  });

  it('REGRESSION: still returns stars and pushedAt when a token cannot read releases (404)', async () => {
    mockGitHub({ body: { ...repoBody, private: true } }, { ok: false, status: 404, body: {} });
    const info = await fetchRepoInfo('a/private', 'tok');
    assert.equal(info?.stars, 3396);
    assert.equal(info?.version, null);
    assert.equal(info?.releaseUrl, null);
    assert.equal(info?.private, true);
  });

  it('still fails when the repo itself is unreadable (404), so a bad token is not hidden', async () => {
    mockGitHub({ ok: false, status: 404, body: {} }, { ok: false, status: 404, body: {} });
    assert.equal(await fetchRepoInfo('a/private', 'tok'), null);
  });

  it('drops release links that are not https://github.com URLs', async () => {
    mockGitHub(
      { body: repoBody },
      { body: [{ tag_name: 'v1', html_url: 'javascript:alert(1)', prerelease: false }] },
    );
    assert.equal((await fetchRepoInfo('a/b'))?.releaseUrl, null);
  });

  it('returns null on unexpected payloads', async () => {
    mockGitHub({ body: repoBody }, { body: { message: 'weird' } });
    assert.equal(await fetchRepoInfo('a/b'), null);
    mock.restoreAll();
    mockGitHub({ body: {} }, { body: [] });
    assert.equal(await fetchRepoInfo('a/b'), null, 'missing pushed_at');
  });

  it('returns null when the network throws', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('offline');
    });
    assert.equal(await fetchRepoInfo('a/b'), null);
  });

  it('queries the right endpoints and sends the token when given', async () => {
    const calls = mockGitHub({ body: repoBody }, { body: [] });
    await fetchRepoInfo('o/r', 'secret');

    assert.deepEqual(calls.map((c) => c.url).sort(), [
      'https://api.github.com/repos/o/r',
      'https://api.github.com/repos/o/r/releases?per_page=10',
    ]);
    for (const { init } of calls) {
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, 'Bearer secret');
      assert.equal(headers.Accept, 'application/vnd.github+json');
    }
  });

  it('sends no Authorization header without a token', async () => {
    const calls = mockGitHub({ body: repoBody }, { body: [] });
    await fetchRepoInfo('o/r');
    assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, undefined);
  });

  it('shares successful results between calls so reloads do not burn the rate limit', async () => {
    const calls = mockGitHub({ body: repoBody }, { body: [] });
    await fetchRepoInfo('o/r');
    await fetchRepoInfo('o/r');
    assert.equal(calls.length, 2, 'one repo call + one releases call, total');
  });

  it('shares in-flight requests', async () => {
    const calls = mockGitHub({ body: repoBody }, { body: [] });
    await Promise.all([fetchRepoInfo('o/r'), fetchRepoInfo('o/r')]);
    assert.equal(calls.length, 2);
  });

  it('does not remember failures', async () => {
    mockGitHub({ ok: false, body: {} }, { body: [] });
    assert.equal(await fetchRepoInfo('o/r'), null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    mock.restoreAll();
    mock.method(console, 'warn', () => {});
    mockGitHub({ body: repoBody }, { body: [] });
    assert.notEqual(await fetchRepoInfo('o/r'), null);
  });

  it('keeps anonymous and authenticated results separate', async () => {
    const calls = mockGitHub({ body: repoBody }, { body: [] });
    await fetchRepoInfo('o/r');
    await fetchRepoInfo('o/r', 'tok');
    assert.equal(calls.length, 4);
  });

  it('explains rate limiting in the console', async () => {
    const warn = mock.method(console, 'warn', () => {});
    mock.method(globalThis, 'fetch', async () => ({
      ok: false,
      status: 403,
      headers: { get: (h: string) => (h === 'x-ratelimit-remaining' ? '0' : null) },
      json: async () => ({}),
    }));
    assert.equal(await fetchRepoInfo('o/r'), null);
    assert.match(
      String(warn.mock.calls[0]?.arguments[0]),
      /o\/r: HTTP 403.*rate limit reached.*GITHUB_TOKEN/,
    );
  });
});
