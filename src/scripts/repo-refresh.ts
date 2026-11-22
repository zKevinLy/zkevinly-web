// Browser: refreshes every RepoMeta footer (`[data-repo]`) with live GitHub/GitLab data, cached
// 1h in localStorage. The UI package knows how to paint it (applyRepoInfo); fetching, caching and
// the Worker proxy are this site's business.
//
// Private repos can't be read anonymously, so they go through the Worker (/api/repo), which
// holds the token, instead of calling GitHub directly.

import { FILTER_REFRESH_EVENT } from '@zkevinly/ui/lib/filter';
import { applyRepoInfo } from '@zkevinly/ui/lib/repo-info';
import {
  cacheKey,
  fetchRepoInfo,
  fetchRepoInfoViaProxy,
  readCachedInfo,
  readStaleInfo,
  repoHost,
  type RepoInfo,
} from '../lib/github';

const TTL = 60 * 60 * 1000;

async function getInfo(repo: string, viaProxy: boolean): Promise<RepoInfo | null> {
  const key = cacheKey(repo);
  let raw: string | null = null;

  try {
    raw = localStorage.getItem(key);
  } catch {
    // Storage unavailable (private mode…): just fetch.
  }

  // Outdated / malformed / expired entries come back null and are refetched.
  const fresh = readCachedInfo(raw, TTL);
  if (fresh) return fresh;

  // Unknown GitHub repos try GitHub directly, then the Worker: a private repo whose build-time
  // lookup failed would otherwise 404 here forever. GitLab repos are public-only: no Worker.
  const info = viaProxy
    ? await fetchRepoInfoViaProxy(repo)
    : ((await fetchRepoInfo(repo)) ??
      (repoHost(repo) === 'github' ? await fetchRepoInfoViaProxy(repo) : null));

  if (info) {
    try {
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), info }));
    } catch {
      // Storage full/unavailable: fine, just refetch next time.
    }
    return info;
  }

  // Rate-limited/offline: an old copy beats an empty footer. (null keeps the build-time values.)
  return readStaleInfo(raw);
}

document.addEventListener('astro:page-load', async () => {
  const foots = document.querySelectorAll<HTMLElement>('[data-repo]');
  await Promise.all(
    Array.from(foots).map(async (foot) => {
      const info = await getInfo(foot.dataset.repo!, foot.dataset.private !== undefined);
      if (info) applyRepoInfo(foot, info);
    }),
  );
  document.dispatchEvent(new CustomEvent(FILTER_REFRESH_EVENT));
});
