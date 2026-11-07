/* global process, fetch, URL, URLSearchParams, AbortSignal, setTimeout, console */
/**
 * Resolves GIFs for the chat bot ahead of time, using the KLIPY API.
 *
 *   KLIPY_API_KEY=xxxx npm run gifs               # fill in rules that have no GIFs yet
 *   KLIPY_API_KEY=xxxx npm run gifs -- --refresh  # re-fetch everything
 *   KLIPY_API_KEY=xxxx npm run gifs -- --only bug,wow
 *
 * Reads  src/config/chatbot-gif-queries.json  (rule id -> search text)
 * Writes src/config/chatbot-gifs.json         (rule id -> [{ url, title }])
 *
 * Why at build time instead of in the browser: KLIPY puts the API key in the
 * request URL, so a browser call would publish the key, and live search would
 * send whatever visitors type to a third party. This way the key stays on your
 * machine, visitors' messages stay local, and you can review/delete GIFs in the
 * output file before committing. The file is only ever rewritten by this script.
 *
 * Env: KLIPY_API_KEY (required), KLIPY_API_BASE, KLIPY_CONTENT_FILTER.
 */
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.KLIPY_API_KEY;
const BASE = (process.env.KLIPY_API_BASE ?? 'https://api.klipy.com').replace(/\/$/, '');
const FILTER = process.env.KLIPY_CONTENT_FILTER ?? 'medium';
const CUSTOMER_ID = 'zkevinly-web-build';
const PER_RULE = 5;

const QUERIES = new URL('../src/config/chatbot-gif-queries.json', import.meta.url);
const OUTPUT = new URL('../src/config/chatbot-gifs.json', import.meta.url);

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set((args[onlyArg + 1] ?? '').split(',').filter(Boolean)) : null;

if (!KEY) {
  console.error('Set KLIPY_API_KEY (create one at https://partner.klipy.com).');
  process.exit(1);
}

/** Never let the key (which lives in the URL) reach logs. */
const redact = (text) => String(text).split(KEY).join('***');

/**
 * Finds a GIF URL in one result. KLIPY nests files by size and format; I prefer
 * a medium size (the chat is ~350px wide) and fall back to whatever exists.
 */
function extractGifUrl(item) {
  const files = item?.files ?? item?.file;
  if (!files || typeof files !== 'object') return null;

  const candidates = [
    files.md?.gif?.url,
    files.sm?.gif?.url,
    files.hd?.gif?.url,
    files.gif?.url,
    files.gif,
  ];
  for (const c of candidates) if (typeof c === 'string' && c.startsWith('http')) return c;

  // Unknown shape: take the first string that looks like a GIF URL.
  const stack = [files];
  while (stack.length) {
    const node = stack.shift();
    for (const value of Object.values(node)) {
      if (typeof value === 'string' && /^https?:\/\/\S+\.gif(\?|$)/i.test(value)) return value;
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

const isAd = (item) => item?.type === 'ad' || item?.is_ad === true || 'ad' in (item ?? {});

async function search(query) {
  const params = new URLSearchParams({
    q: query,
    page: '1',
    per_page: String(Math.max(8, PER_RULE * 3)), // API minimum is 8
    customer_id: CUSTOMER_ID,
    content_filter: FILTER,
  });
  const url = `${BASE}/api/v1/${encodeURIComponent(KEY)}/gifs/search?${params}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${redact(body).slice(0, 300)}`);

  const json = JSON.parse(body);
  const items = json?.data?.data ?? json?.data ?? json?.results ?? [];
  if (!Array.isArray(items)) throw new Error('Unexpected response shape (no result list).');

  const gifs = [];
  for (const item of items) {
    if (isAd(item)) continue;
    const gifUrl = extractGifUrl(item);
    if (!gifUrl) continue;
    gifs.push({ url: gifUrl, title: item.title || item.slug || query });
  }

  if (items.length && !gifs.length) {
    console.warn(
      `  ! ${items.length} results but no GIF URL found. First item keys: ${Object.keys(items[0] ?? {}).join(', ')}`,
    );
  }
  return gifs;
}

const queries = JSON.parse(await readFile(QUERIES, 'utf8'));
let library = {};
try {
  library = JSON.parse(await readFile(OUTPUT, 'utf8'));
} catch {
  // First run: start empty.
}

let failures = 0;

for (const [id, query] of Object.entries(queries)) {
  if (only && !only.has(id)) continue;
  if (!refresh && !only && library[id]?.length) {
    console.log(`= ${id}: keeping ${library[id].length} existing`);
    continue;
  }

  const terms = Array.isArray(query) ? query : [query];
  try {
    const seen = new Set();
    const picked = [];
    for (const term of terms) {
      for (const gif of await search(term)) {
        if (seen.has(gif.url)) continue;
        seen.add(gif.url);
        picked.push(gif);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    library[id] = picked.slice(0, PER_RULE);
    console.log(`+ ${id}: ${library[id].length} GIFs ("${terms.join('", "')}")`);
  } catch (error) {
    failures += 1;
    console.error(`x ${id}: ${redact(error.message ?? error)}`);
  }
}

await writeFile(OUTPUT, JSON.stringify(library, null, 2) + '\n');
console.log(
  `\nWrote ${new URL(OUTPUT).pathname}. Review it, delete any GIF you don't like, then commit.`,
);
process.exit(failures ? 1 : 0);
