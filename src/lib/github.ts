// GitHub helpers shared by the build (RepoMeta.astro frontmatter) and the browser
// (RepoMeta.astro <script>). Keep this file free of Node-only APIs.

export interface RepoInfo {
  /** ISO timestamp of the most recent push. */
  pushedAt: string;
  stars: number;
  /** Tag of the latest published (non-draft, non-prerelease) release, if any. */
  version: string | null;
  releaseUrl: string | null;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft?: boolean;
  prerelease?: boolean;
}

export type Freshness = 'hot' | 'warm' | 'cold';

const API = 'https://api.github.com';

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

/**
 * Fetches repo + latest release. Returns null on any failure (rate limit,
 * offline, repo gone) so callers can keep whatever they already have.
 *
 * Uses the releases *list* rather than /releases/latest so a repo with no
 * releases answers 200 [] instead of a 404 (which spams the browser console).
 */
export async function fetchRepoInfo(repo: string, token?: string): Promise<RepoInfo | null> {
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

    if (!repoRes.ok) return null;

    const data = await repoRes.json();
    const releases: GitHubRelease[] = relRes.ok ? await relRes.json() : [];
    const latest = releases.find((r) => !r.draft && !r.prerelease);

    return {
      pushedAt: data.pushed_at,
      stars: data.stargazers_count ?? 0,
      version: latest?.tag_name ?? null,
      releaseUrl: latest?.html_url ?? null,
    };
  } catch {
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
