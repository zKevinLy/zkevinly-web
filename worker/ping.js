import { site } from '../src/config';
import { collectPingTargets } from '../src/lib/ping';
import { json } from './http.js';

/**
 * GET /api/ping?url=https://example.com/  ->  { up, ms?, status? }
 *
 * Status dots on cards whose `ping` has `via: 'worker'` (the default). The Worker makes the
 * request from Cloudflare's network and says whether anything answered:
 *   up      the host replied with a status below 500 (a 301 or a 401 still means "it's there")
 *   down    no reply in time, a connection error, or a 5xx
 *   ms      how long the reply took, measured here (not from the visitor)
 *
 * Only URLs that the site config marks for a Worker ping are ever requested; anything else
 * answers 404, the same as a URL that doesn't exist. So this can't be used to scan other hosts.
 * It can't see private/LAN addresses either: those cards use `via: 'browser'`.
 */

/** Browsers may reuse an answer for 30 s; the edge cache too, so a busy page can't hammer a host. */
const TTL = 30;
const TIMEOUT_MS = 5000;

/** The normalised URL of every Worker-checked ping on `pages`. Browser-checked ones are left out. */
export const workerPings = (pages) =>
  new Set(
    collectPingTargets(pages)
      .filter((target) => target.via === 'worker')
      .map((target) => target.url),
  );

const ALLOWED = workerPings(Object.values(site.pages));

/** One request. HEAD first (cheap); some servers refuse it, so those get one GET. */
async function probe(url) {
  const started = Date.now();
  const ask = async (method) => {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'zkevinly-ping/1.0 (+https://zkevinly.com)' },
    });
    // Nothing reads the body; let go of the connection.
    res.body?.cancel().catch(() => {});
    return res;
  };

  try {
    let res = await ask('HEAD');
    if (res.status === 405 || res.status === 501) res = await ask('GET');
    return { up: res.status < 500, ms: Date.now() - started, status: res.status };
  } catch {
    return { up: false };
  }
}

/**
 * @param {Request} request
 * @param {unknown} [env]
 * @param {{ waitUntil(p: Promise<unknown>): void }} [ctx]
 * @param {Set<string>} [allowed] the URLs that may be checked (tests pass their own)
 */
export async function handlePing(request, env, ctx, allowed = ALLOWED) {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const url = new URL(request.url);
  // Same normalisation as the config side (src/lib/ping.ts): an exact match or nothing.
  let target = null;
  try {
    const asked = new URL(url.searchParams.get('url') ?? '');
    asked.hash = '';
    target = asked.toString();
  } catch {
    // not a URL: falls through to 404
  }
  if (!target || !allowed.has(target)) return json({ error: 'not found' }, 404);

  const cache = typeof caches === 'undefined' ? null : caches.default;
  const cacheKey = new Request(`${url.origin}/api/ping?url=${encodeURIComponent(target)}`);
  const hit = await cache?.match(cacheKey);
  if (hit) return hit;

  const fresh = json(await probe(target), 200, `public, max-age=${TTL}`);
  if (cache) {
    const put = cache.put(cacheKey, fresh.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return fresh;
}
