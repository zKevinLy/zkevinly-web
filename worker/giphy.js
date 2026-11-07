/**
 * Minimal GIPHY GIF search client. Runs inside the Cloudflare Worker (and the
 * dev-server shim in astro.config.mjs), not in the browser: that way the visitor's
 * IP, cookies and headers never reach GIPHY and the key stays out of the page.
 *
 * Results are deliberately not cached or stored anywhere (GIPHY's guidelines ask
 * integrations not to cache API responses or media URLs).
 */

const API = 'https://api.giphy.com';
const MAX_QUERY = 80;
const RATINGS = new Set(['g', 'pg', 'pg-13', 'r']);

/** Trim, collapse whitespace, drop control characters, cap length. */
export function normalizeQuery(raw) {
  return String(raw ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_QUERY);
}

/** One of GIPHY's content ratings (g, pg, pg-13, r); anything else becomes pg. */
export function normalizeRating(raw) {
  const rating = String(raw ?? '')
    .trim()
    .toLowerCase();
  return RATINGS.has(rating) ? rating : 'pg';
}

/** Only ever hand the browser https URLs that point at GIPHY's own hosts. */
function isGiphyUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com'))
    );
  } catch {
    return false;
  }
}

/**
 * Picks a GIF URL from one result. GIPHY returns many renditions under `images`;
 * prefer a small one (the chat is ~350px wide) and fall back to bigger ones.
 */
export function extractGifUrl(item) {
  const images = item?.images;
  if (!images || typeof images !== 'object') return null;

  for (const name of ['fixed_width', 'fixed_height', 'downsized', 'original']) {
    const url = images[name]?.url;
    if (isGiphyUrl(url)) return url;
  }
  return null;
}

/**
 * @param {{ query: string, key: string, rating?: string, limit?: number,
 *           base?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} options
 * @returns {Promise<{ url: string, title: string }[]>}
 */
export async function searchGifs({
  query,
  key,
  rating,
  limit = 8,
  base = API,
  fetchImpl = fetch,
  timeoutMs = 6000,
}) {
  const params = new URLSearchParams({
    api_key: key,
    q: query,
    limit: String(Math.min(50, Math.max(1, limit))),
    offset: '0',
    rating: normalizeRating(rating),
    lang: 'en',
  });

  const res = await fetchImpl(`${base}/v1/gifs/search?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // Body omitted on purpose. The status lets callers tell a bad or rate-limited key apart.
    throw Object.assign(new Error(`GIPHY responded ${res.status}`), { status: res.status });
  }

  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new Error('Unexpected GIPHY response shape');

  const gifs = [];
  for (const item of json.data) {
    const url = extractGifUrl(item);
    if (url) gifs.push({ url, title: String(item.title || query).trim() || query });
    if (gifs.length >= limit) break;
  }
  return gifs;
}

/**
 * Turns one or more key settings into a clean list. Each value may hold several
 * keys separated by commas, spaces or newlines; blanks and duplicates are dropped.
 * @param {...(string | undefined)} values
 * @returns {string[]}
 */
export function parseKeys(...values) {
  const keys = values.flatMap((value) => String(value ?? '').split(/[\s,]+/)).filter(Boolean);
  return [...new Set(keys)];
}

/** Random order (Fisher-Yates), so load spreads across keys and the rest act as backups. */
export function shuffle(items, rng = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A different key can help with these; with anything else (outage, bad response) it won't.
const KEY_PROBLEM = new Set([401, 403, 429]);

/**
 * Like searchGifs, but takes several keys: starts with a randomly chosen one and
 * moves on to the next only if GIPHY rejects that key (invalid, forbidden or
 * rate limited).
 * @param {{ keys: string[], rng?: () => number } & Omit<Parameters<typeof searchGifs>[0], 'key'>} options
 */
export async function searchGifsWithKeys({ keys, rng, ...options }) {
  let lastError = new Error('No GIPHY API key configured');
  for (const key of shuffle(keys, rng)) {
    try {
      return await searchGifs({ ...options, key });
    } catch (error) {
      lastError = error;
      if (!KEY_PROBLEM.has(error?.status)) throw error;
    }
  }
  throw lastError;
}
