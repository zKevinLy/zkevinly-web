import { normalizeQuery, parseKeys, searchGifsWithKeys } from './giphy.js';
import { json } from './http.js';

/**
 * GET /api/gif?q=...  ->  { gifs: [{ url, title }] }
 *
 * Privacy: the visitor's text is used for the GIPHY search and nothing else. It
 * is not logged and not stored, and only the normalized query (no IP, cookies or
 * other headers) is forwarded. Responses are never cached (see giphy.js).
 */

/**
 * Every chat message makes one GIPHY call against a quota that is shared by all visitors, so
 * a per-visitor limit keeps one person from using it up. The limit is a Cloudflare Rate
 * Limiting binding (GIF_LIMITER in wrangler.toml). The visitor's IP is only the limiter's
 * key: it is not logged, stored, or sent to GIPHY. No binding (dev server, tests) means no
 * limit, and a limiter that errors lets the request through rather than breaking the chat.
 */
async function allowed(request, env) {
  if (!env.GIF_LIMITER) return true;
  try {
    const key = request.headers.get('CF-Connecting-IP') ?? 'anonymous';
    const { success } = await env.GIF_LIMITER.limit({ key });
    return success;
  } catch {
    return true;
  }
}

/**
 * @param {Request} request
 * @param {{ GIPHY_API_KEYS?: string, GIPHY_API_KEY?: string, GIPHY_RATING?: string,
 *           GIF_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> } }} env
 */
export async function handleGif(request, env) {
  if (request.method !== 'GET') return json({ gifs: [] }, 405);

  const query = normalizeQuery(new URL(request.url).searchParams.get('q'));
  if (!query) return json({ gifs: [] }, 400);

  if (!(await allowed(request, env))) {
    return json({ gifs: [] }, 429, 'no-store', { 'Retry-After': '60' });
  }

  // GIPHY_API_KEYS holds one or more keys (comma-separated); GIPHY_API_KEY still works too.
  const keys = parseKeys(env.GIPHY_API_KEYS, env.GIPHY_API_KEY);
  if (!keys.length) return json({ gifs: [] }, 503);

  try {
    const gifs = await searchGifsWithKeys({ query, keys, rating: env.GIPHY_RATING });
    return json({ gifs });
  } catch {
    return json({ gifs: [] }, 502);
  }
}
