// GitHub helpers shared by the build (RepoMeta.astro frontmatter) and the browser
// (RepoMeta.astro <script>). Keep this file free of Node-only APIs.

import type { Entry } from '../config/types';

export interface RepoInfo {
  /** ISO timestamp of the most recent push. */
  pushedAt: string;
  stars: number;
  /** Tag of the newest published (non-draft) release, pre-releases included, if any. */
  version: string | null;
  releaseUrl: string | null;
  /** True when `version` is a GitHub pre-release (beta, RC, nightly…). */
  prerelease: boolean;
}

export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

export type Freshness = 'hot' | 'warm' | 'cold';

const API = 'https://api.github.com';

/**
 * Bump whenever the shape of `RepoInfo` (or how it's computed) changes, so the
 * browser stops trusting data cached by an older version of the site. Without
 * this, an entry cached as "no release" before pre-releases were supported
 * keeps hiding the tag until its TTL runs out.
 */
export const CACHE_VERSION = 2;

export const cacheKey = (repo: string) => `gh:v${CACHE_VERSION}:${repo}`;

/** "https://github.com/owner/repo/anything" -> "owner/repo" (github.com only). */
export function parseRepo(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.hostname !== 'github.com') return null;
    const [owner, name] = url.pathname.split('/').filter(Boolean);
    return owner && name ? `${owner}/${name.replace(/\.git$/, '')}` : null;
  } catch {
    return null;
  }
}

/** The repo behind an entry: inferred from a github.com link unless set or disabled (`false`). */
export function entryRepo(entry: Pick<Entry, 'repo' | 'href'>): string | null {
  return entry.repo === false ? null : (entry.repo ?? parseRepo(entry.href));
}

/**
 * The release to show: the newest one that is actually published. GitHub lists
 * newest-first, and pre-releases count (many projects, e.g. Nuvio, only ship
 * betas). Drafts are never shown; entries without a tag are ignored.
 */
export function pickRelease(releases: unknown): GitHubRelease | null {
  if (!Array.isArray(releases)) return null;
  const found = releases.find(
    (r): r is GitHubRelease =>
      !!r && typeof r === 'object' && !r.draft && typeof r.tag_name === 'string' && !!r.tag_name,
  );
  return found ?? null;
}

/** Runtime check for data read back from localStorage (it may be from an older version, or junk). */
export function isRepoInfo(value: unknown): value is RepoInfo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.pushedAt === 'string' &&
    typeof v.stars === 'number' &&
    (v.version === null || typeof v.version === 'string') &&
    (v.releaseUrl === null || typeof v.releaseUrl === 'string') &&
    typeof v.prerelease === 'boolean'
  );
}

/** Parses a cached `{ t, info }` blob; null when missing, malformed or from an older version. */
function parseCached(raw: string | null): { t: number; info: RepoInfo } | null {
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as { t?: unknown; info?: unknown };
    if (typeof cached.t !== 'number' || !isRepoInfo(cached.info)) return null;
    return { t: cached.t, info: cached.info };
  } catch {
    return null;
  }
}

/** Fresh cached info; null when missing, malformed, outdated or older than `ttl`. */
export function readCachedInfo(raw: string | null, ttl: number, now = Date.now()): RepoInfo | null {
  const cached = parseCached(raw);
  return cached && now - cached.t < ttl ? cached.info : null;
}

/**
 * Cached info of any age. Used when a refetch fails (rate limit, offline): an
 * hour-old star count beats a blank card footer.
 */
export function readStaleInfo(raw: string | null): RepoInfo | null {
  return parseCached(raw)?.info ?? null;
}

/**
 * Fetches repo + latest release. Returns null on any failure (rate limit,
 * offline, repo gone) so callers can keep whatever they already have.
 *
 * Uses the releases *list* rather than /releases/latest so a repo with no
 * releases answers 200 [] instead of a 404 (which spams the browser console).
 */
export async function fetchRepoInfo(repo: string, token?: string): Promise<RepoInfo | null> {
  // Dev servers re-render on every reload, and unauthenticated GitHub calls are capped
  // at 60/hour, so successful results (and in-flight requests) are shared for a few minutes.
  const key = `${repo}|${token ? 'auth' : 'anon'}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < MEMO_TTL) return hit.promise;

  const promise = fetchRepoInfoUncached(repo, token);
  memo.set(key, { t: Date.now(), promise });
  // Never remember a failure: the next call should try again.
  void promise.then((info) => {
    if (!info && memo.get(key)?.promise === promise) memo.delete(key);
  });
  return promise;
}

const MEMO_TTL = 5 * 60 * 1000;
const memo = new Map<string, { t: number; promise: Promise<RepoInfo | null> }>();

/** For tests. */
export function clearRepoInfoMemo() {
  memo.clear();
}

/** Says *why* GitHub refused, since a silent blank footer is miserable to debug. */
function warn(repo: string, res: Response) {
  const remaining = res.headers?.get?.('x-ratelimit-remaining');
  const hint =
    res.status === 403 || res.status === 429
      ? remaining === '0'
        ? ' (rate limit reached; set GITHUB_TOKEN at build time, or wait up to an hour)'
        : ' (forbidden or rate limited)'
      : '';
  console.warn(`[github] ${repo}: HTTP ${res.status}${hint}`);
}

async function fetchRepoInfoUncached(repo: string, token?: string): Promise<RepoInfo | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init = { headers, signal: AbortSignal.timeout(8000) };

  try {
    const [repoRes, relRes] = await Promise.all([
      fetch(`${API}/repos/${repo}`, init),
      fetch(`${API}/repos/${repo}/releases?per_page=10`, init),
    ]);

    // Either call failing (rate limit, outage) means we only have half the story.
    // Report failure rather than a version-less result that the browser would
    // then cache for an hour.
    if (!repoRes.ok || !relRes.ok) {
      warn(repo, repoRes.ok ? relRes : repoRes);
      return null;
    }

    const data = await repoRes.json();
    const releases: unknown = await relRes.json();
    // A non-array body means GitHub sent something unexpected: same as a failure.
    if (!Array.isArray(releases) || typeof data?.pushed_at !== 'string') return null;

    // Newest published release, betas included (the list is newest-first).
    const latest = pickRelease(releases);

    return {
      pushedAt: data.pushed_at,
      stars: data.stargazers_count ?? 0,
      version: latest?.tag_name ?? null,
      releaseUrl: latest?.html_url ?? null,
      prerelease: latest?.prerelease === true,
    };
  } catch (error) {
    console.warn(`[github] ${repo}: request failed`, error);
    return null;
  }
}

/** "3 days ago", "2 months ago", "just now". */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** hot = touched in the last 2 weeks (pulses), warm = last 3 months, else cold. */
export function freshness(iso: string, now = Date.now()): Freshness {
  const days = (now - new Date(iso).getTime()) / 86_400_000;
  if (days <= 14) return 'hot';
  if (days <= 90) return 'warm';
  return 'cold';
}
