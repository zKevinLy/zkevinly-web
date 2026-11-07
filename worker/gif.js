import { normalizeQuery, parseKeys, searchGifsWithKeys } from './giphy.js';

/**
 * GET /api/gif?q=...  ->  { gifs: [{ url, title }] }
 *
 * Privacy: the visitor's text is used for the GIPHY search and nothing else. It
 * is not logged and not stored, and only the normalized query (no IP, cookies or
 * other headers) is forwarded. Responses are never cached (see giphy.js).
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

/**
 * @param {Request} request
 * @param {{ GIPHY_API_KEYS?: string, GIPHY_API_KEY?: string, GIPHY_RATING?: string }} env
 */
export async function handleGif(request, env) {
  if (request.method !== 'GET') return json({ gifs: [] }, 405);

  const query = normalizeQuery(new URL(request.url).searchParams.get('q'));
  if (!query) return json({ gifs: [] }, 400);

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
