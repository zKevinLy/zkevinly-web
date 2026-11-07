import { normalizeQuery, searchGifs } from './klipy.js';

/**
 * GET /api/gif?q=...  ->  { gifs: [{ url, title }] }
 *
 * Privacy: the visitor's text is used for the KLIPY search and nothing else. It
 * is not logged, not stored, and only the normalized query (no IP, cookies or
 * other headers) is forwarded. Results are cached by query for an hour so
 * repeats don't hit KLIPY.
 */

const json = (body, status = 200, cacheControl = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });

/**
 * @param {Request} request
 * @param {{ KLIPY_API_KEY?: string, KLIPY_CONTENT_FILTER?: string }} env
 * @param {{ waitUntil(p: Promise<unknown>): void }} [ctx]
 */
export async function handleGif(request, env, ctx) {
  if (request.method !== 'GET') return json({ gifs: [] }, 405);

  const query = normalizeQuery(new URL(request.url).searchParams.get('q'));
  if (!query) return json({ gifs: [] }, 400);
  if (!env.KLIPY_API_KEY) return json({ gifs: [] }, 503);

  const cache = globalThis.caches?.default;
  const cacheKey = new Request(`https://gif-cache.invalid/?q=${encodeURIComponent(query)}`);

  const hit = await cache?.match(cacheKey);
  if (hit) return hit;

  let gifs;
  try {
    gifs = await searchGifs({
      query,
      key: env.KLIPY_API_KEY,
      filter: env.KLIPY_CONTENT_FILTER,
    });
  } catch {
    return json({ gifs: [] }, 502);
  }

  const response = json({ gifs }, 200, `public, max-age=${gifs.length ? 3600 : 300}`);
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
