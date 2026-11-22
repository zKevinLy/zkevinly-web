// Browser-side: repaints a RepoMeta footer with fresher repository data. The UI knows how to
// show the data; where it comes from (GitHub, GitLab, a proxy, a cache) is the app's business.

import { writeStats } from './filter';
import { freshness, relativeTime } from './time';
import type { RepoInfo } from '../types';

export const versionTitle = (prerelease: boolean | undefined) =>
  prerelease ? 'Latest pre-release' : 'Latest release';

/** Updates the badges inside one `.node-foot[data-repo]` and re-feeds the page filter's sort. */
export function applyRepoInfo(foot: HTMLElement, info: RepoInfo) {
  const visibility = foot.querySelector<HTMLElement>('[data-role="visibility"]');
  if (visibility) {
    visibility.title = info.private ? 'Private repository' : 'Public repository';
    const lock = visibility.querySelector<HTMLElement>('[data-icon="lock"]');
    const globe = visibility.querySelector<HTMLElement>('[data-icon="globe"]');
    if (lock) lock.hidden = !info.private;
    if (globe) globe.hidden = info.private;
    const label = visibility.querySelector('[data-role="visibility-text"]');
    if (label) label.textContent = info.private ? 'Private' : 'Public';
    foot.toggleAttribute('data-private', info.private);
  }

  const version = foot.querySelector<HTMLAnchorElement>('[data-role="version"]');
  const versionText = foot.querySelector('[data-role="version-text"]');
  if (version && versionText) {
    version.hidden = !info.version;
    if (info.version) {
      versionText.textContent = info.version;
      if (info.releaseUrl) version.href = info.releaseUrl;
      version.title = versionTitle(info.prerelease);
      version.toggleAttribute('data-prerelease', info.prerelease);
    }
  }

  const stars = foot.querySelector<HTMLElement>('[data-role="stars"]');
  const starsText = foot.querySelector('[data-role="stars-text"]');
  if (stars && starsText) {
    stars.hidden = false;
    starsText.textContent = info.stars.toLocaleString('en-US');
  }

  const updated = foot.querySelector<HTMLElement>('[data-role="updated"]');
  const time = updated?.querySelector('time');
  if (updated && time && info.pushedAt) {
    updated.hidden = false;
    time.setAttribute('datetime', info.pushedAt);
    time.title = new Date(info.pushedAt).toUTCString();
    time.textContent = relativeTime(info.pushedAt);
    updated.dataset.fresh = freshness(info.pushedAt);
  }

  // Keep the page's sort-by-updated / sort-by-stars honest too.
  writeStats(foot.closest<HTMLElement>('[data-filter-item]'), {
    pushedAt: info.pushedAt,
    stars: info.stars,
  });
}
