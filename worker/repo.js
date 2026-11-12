import projects from '../src/config/projects';
import { entryRepo, fetchRepoInfo, repoHost } from '../src/lib/github';

/**
 * GET /api/repo?repo=owner/name  ->  { pushedAt, stars, version, releaseUrl, prerelease, private }
 *
 * Lets the browser show release / star / commit info for PRIVATE repos without ever
 * seeing a GitHub token: the token lives only in the Worker (secret GITHUB_TOKEN) and
 * the browser just gets the small public-safe summary.
 *
 * Only repos listed on the Projects page are served, so this can't be used to probe
 * other repos the token happens to be able to read. Everything else answers 404, the
 * same as a repo that doesn't exist.
 *
 * Set the token once with:  npx wrangler secret put GITHUB_TOKEN
 * (a fine-grained PAT with read-only Contents + Metadata on those repos)
 */

/** Browsers may reuse a reply for 5 minutes; the edge cache keeps it 10 (GitHub allows 5,000/hour with a PAT). */
const BROWSER_TTL = 300;
const EDGE_TTL = 600;
/** After a failure the edge remembers for a short while, so an outage or bad token can't burn the PAT's rate limit. */
const FAIL_TTL = 30;

/** lower-case "owner/name" -> "owner/name" as written in the config. */
const ALLOWED = new Map(
  projects.items
    .map((entry) => entryRepo(entry))
    // GitHub only: the token is a GitHub token, and GitLab repos are read anonymously.
    .filter((repo) => typeof repo === 'string' && repoHost(repo) === 'github')
    .map((repo) => [repo.toLowerCase(), repo]),
);

const json = (body, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });

/**
 * @param {Request} request
 * @param {{ GITHUB_TOKEN?: string }} env
 * @param {{ waitUntil(p: Promise<unknown>): void }} [ctx]
 */
export async function handleRepo(request, env, ctx) {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(request.url);
  const repo = ALLOWED.get((url.searchParams.get('repo') ?? '').trim().toLowerCase());
  if (!repo) return json({ error: 'not found' }, 404);

  // Without a token a private repo would only 404 at GitHub; say what is wrong instead.
  if (!env.GITHUB_TOKEN) return json({ error: 'not configured' }, 503);

  // One cache entry per allowed repo, whatever casing the caller used.
  const cache = typeof caches === 'undefined' ? null : caches.default;
  const cacheKey = new Request(`${url.origin}/api/repo?repo=${encodeURIComponent(repo)}`);

  const failKey = new Request(`${url.origin}/api/repo?repo=${encodeURIComponent(repo)}&failed=1`);

  const hit = await cache?.match(cacheKey);
  if (hit) return hit;
  if (await cache?.match(failKey)) return json({ error: 'upstream' }, 502);

  const info = await fetchRepoInfo(repo, env.GITHUB_TOKEN);
  if (!info) {
    // Never cached for the browser (no-store), but the edge backs off briefly.
    if (cache) {
      const put = cache.put(
        failKey,
        new Response('', { headers: { 'Cache-Control': `public, max-age=${FAIL_TTL}` } }),
      );
      if (ctx?.waitUntil) ctx.waitUntil(put);
      else await put;
    }
    return json({ error: 'upstream' }, 502);
  }

  const fresh = json(info, 200, `public, max-age=${BROWSER_TTL}`);
  if (cache) {
    const stored = new Response(fresh.clone().body, fresh);
    stored.headers.set('Cache-Control', `public, max-age=${EDGE_TTL}`);
    const put = cache.put(cacheKey, stored);
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return fresh;
}
