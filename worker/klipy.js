/**
 * Minimal KLIPY GIF search client. Runs inside the Cloudflare Worker (and the
 * dev-server shim in astro.config.mjs), never in the browser: KLIPY puts the API
 * key in the request URL, so it must stay server-side.
 */

const API = 'https://api.klipy.com';
const CUSTOMER_ID = 'zkevinly-web'; // one fixed id: visitors are never identified
const MAX_QUERY = 80;

/** Trim, collapse whitespace, drop control characters, cap length. */
export function normalizeQuery(raw) {
  return String(raw ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_QUERY);
}

/**
 * Finds a GIF URL in one result. KLIPY nests files by size and format; prefer a
 * medium size (the chat is ~350px wide) and fall back to whatever exists.
 */
export function extractGifUrl(item) {
  const files = item?.files ?? item?.file;
  if (!files || typeof files !== 'object') return null;

  const candidates = [
    files.md?.gif?.url,
    files.sm?.gif?.url,
    files.hd?.gif?.url,
    files.gif?.url,
    files.gif,
  ];
  for (const c of candidates) if (typeof c === 'string' && c.startsWith('https://')) return c;

  // Unknown shape: first string that looks like an https GIF URL.
  const queue = [files];
  while (queue.length) {
    const node = queue.shift();
    for (const value of Object.values(node)) {
      if (typeof value === 'string' && /^https:\/\/\S+\.gif(\?|$)/i.test(value)) return value;
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return null;
}

const isAd = (item) => item?.type === 'ad' || item?.is_ad === true || 'ad' in (item ?? {});

/**
 * @param {{ query: string, key: string, filter?: string, limit?: number,
 *           base?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} options
 * @returns {Promise<{ url: string, title: string }[]>}
 */
export async function searchGifs({
  query,
  key,
  filter = 'medium',
  limit = 8,
  base = API,
  fetchImpl = fetch,
  timeoutMs = 6000,
}) {
  const params = new URLSearchParams({
    q: query,
    page: '1',
    per_page: String(Math.max(8, limit * 2)), // API minimum is 8
    customer_id: CUSTOMER_ID,
    content_filter: filter,
  });

  const res = await fetchImpl(`${base}/api/v1/${encodeURIComponent(key)}/gifs/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`KLIPY responded ${res.status}`); // body omitted: it may echo the key

  const json = await res.json();
  const items = json?.data?.data ?? json?.data ?? json?.results ?? [];
  if (!Array.isArray(items)) throw new Error('Unexpected KLIPY response shape');

  const gifs = [];
  for (const item of items) {
    if (isAd(item)) continue;
    const url = extractGifUrl(item);
    if (url) gifs.push({ url, title: item.title || item.slug || query });
    if (gifs.length >= limit) break;
  }
  return gifs;
}
