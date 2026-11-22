import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, type Dom } from '../helpers/dom';
import { cacheKey, clearRepoInfoMemo, type RepoInfo } from '../../src/lib/github';

const PUSHED = '2026-11-07T00:00:00Z';
const TAG = 'https://github.com/o/r/releases/tag/v9.9.9';
const github = (url: string) =>
  url.includes('/releases')
    ? [{ tag_name: 'v9.9.9', html_url: TAG, prerelease: false }]
    : { pushed_at: PUSHED, stargazers_count: 42, private: false };
const proxied: RepoInfo = {
  pushedAt: PUSHED,
  stars: 5,
  version: 'v1.0.0',
  releaseUrl: 'https://github.com/o/r/releases/tag/v1.0.0',
  prerelease: false,
  private: true,
};

const FOOT = (repo: string, extra = '') => `
<article data-filter-item>
  <footer class="node-foot" data-repo="${repo}" ${extra}>
    <a data-role="version" hidden><span data-role="version-text"></span></a>
    <span data-role="stars" hidden><span data-role="stars-text"></span></span>
  </footer>
</article>`;

let dom: Dom;
let calls: string[];
let route: (url: string) => { ok: boolean; body?: unknown };
let refreshed: number;

const mount = (html: string) => (dom.document.body.innerHTML = html);
const run = async () => {
  dom.document.dispatchEvent(new dom.window.Event('astro:page-load'));
  await settle(10);
};
const version = () => dom.document.querySelector('[data-role=version-text]')!.textContent;
const stars = () => dom.document.querySelector('[data-role=stars-text]')!.textContent;

before(async () => {
  dom = installDom();
  dom.document.addEventListener('filter:refresh', () => refreshed++);
  await import('../../src/scripts/repo-refresh');
});
after(() => dom.restore());

beforeEach(() => {
  calls = [];
  refreshed = 0;
  clearRepoInfoMemo();
  dom.window.localStorage.clear();
  route = (url) => ({ ok: true, body: github(url) });
  mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(String(url));
    const { ok, body } = route(String(url));
    return { ok, status: ok ? 200 : 404, json: async () => body };
  });
  mock.method(console, 'warn', () => {});
});
afterEach(() => mock.restoreAll());

describe('repo refresh', () => {
  it('fetches fresh data, paints the footer, caches it, and tells the filter to re-sort', async () => {
    mount(FOOT('o/r'));
    await run();
    assert.equal(version(), 'v9.9.9');
    assert.equal(stars(), '42');
    assert.ok(calls.every((url) => url.startsWith('https://api.github.com/')));
    const cached = JSON.parse(dom.window.localStorage.getItem(cacheKey('o/r'))!);
    assert.equal(cached.info.version, 'v9.9.9');
    assert.equal(refreshed, 1);
  });

  it('uses a fresh cached copy without asking anyone', async () => {
    dom.window.localStorage.setItem(
      cacheKey('o/r'),
      JSON.stringify({ t: Date.now(), info: { ...proxied, version: 'cached' } }),
    );
    mount(FOOT('o/r'));
    await run();
    assert.deepEqual(calls, []);
    assert.equal(version(), 'cached');
  });

  it('ignores an expired copy and refetches', async () => {
    dom.window.localStorage.setItem(
      cacheKey('o/r'),
      JSON.stringify({ t: Date.now() - 2 * 3_600_000, info: { ...proxied, version: 'old' } }),
    );
    mount(FOOT('o/r'));
    await run();
    assert.equal(version(), 'v9.9.9');
  });

  it('private repos go through the Worker only', async () => {
    route = (url) => (url.startsWith('/api/repo') ? { ok: true, body: proxied } : { ok: false });
    mount(FOOT('o/r', 'data-private'));
    await run();
    assert.deepEqual(calls, ['/api/repo?repo=o%2Fr']);
    assert.equal(version(), 'v1.0.0');
  });

  it('falls back to the Worker for a GitHub repo that cannot be read anonymously', async () => {
    route = (url) => (url.startsWith('/api/repo') ? { ok: true, body: proxied } : { ok: false });
    mount(FOOT('o/r'));
    await run();
    assert.ok(calls.some((url) => url.startsWith('/api/repo')));
    assert.equal(version(), 'v1.0.0');
  });

  it('never asks the Worker about a GitLab repo (it has no token for it)', async () => {
    route = () => ({ ok: false });
    mount(FOOT('gitlab:g/p'));
    await run();
    assert.ok(calls.length > 0);
    assert.ok(calls.every((url) => !url.startsWith('/api/repo')));
    assert.equal(version(), '');
  });

  it('prefers an old copy over an empty footer when the lookup fails', async () => {
    dom.window.localStorage.setItem(
      cacheKey('o/r'),
      JSON.stringify({ t: 1, info: { ...proxied, version: 'stale' } }),
    );
    route = () => ({ ok: false });
    mount(FOOT('o/r'));
    await run();
    assert.equal(version(), 'stale');
  });

  it('leaves the build-time values when there is nothing at all', async () => {
    route = () => ({ ok: false });
    mount(FOOT('o/r'));
    await run();
    assert.equal(version(), '');
    assert.equal(refreshed, 1);
  });

  it('still works when storage is unavailable', async () => {
    mock.method(dom.window.Storage.prototype, 'getItem', () => {
      throw new Error('denied');
    });
    mock.method(dom.window.Storage.prototype, 'setItem', () => {
      throw new Error('full');
    });
    mount(FOOT('o/r'));
    await run();
    assert.equal(version(), 'v9.9.9');
  });

  it('does nothing but signal on a page with no repos', async () => {
    mount('<p>nothing</p>');
    await run();
    assert.deepEqual(calls, []);
    assert.equal(refreshed, 1);
  });
});
