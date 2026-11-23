// Node host for the same site the Cloudflare Worker serves: static files from dist/ (with the
// `_headers` rules and the 404 page) plus /api/* through the Worker's own handlers (worker/index.js).
// Nothing is reimplemented, so the container and the Worker behave the same.
//
//   node server/node.mjs        PORT (default 8080), DIST_DIR (default ./dist)
//
// Secrets (GIPHY_API_KEYS, GITHUB_TOKEN, ...) are read from the environment. The Worker's per-visitor
// GIF rate limit is replaced by a small in-memory one (LIMITER below).
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import worker from '../worker/index.js';
import { headersFor, parseHeaders } from './headers.mjs';

const DIST = resolve(process.env.DIST_DIR ?? 'dist'); // the container sets DIST_DIR; locally run from the repo root
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pf_meta': 'application/octet-stream',
  '.pagefind': 'application/octet-stream',
  '.pf_index': 'application/octet-stream',
  '.pf_fragment': 'application/octet-stream',
};

const headerFile = join(DIST, '_headers');
const rules = existsSync(headerFile) ? parseHeaders(readFileSync(headerFile, 'utf8')) : [];

/** Stand-in for the Worker's GIF_LIMITER binding: `limit` requests per `period` seconds per key. */
const hits = new Map();
const LIMITER = {
  async limit({ key }) {
    const limit = Number(process.env.GIF_RATE_LIMIT) || 20;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= limit) return { success: false };
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000)
      for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
    return { success: true };
  },
};

/** Finds the file for a URL path the way Workers assets do: exact, `.html`, or `/index.html`. */
function resolveFile(pathname) {
  const path = normalize(decodeURIComponent(pathname));
  const base = join(DIST, path);
  if (base !== DIST && !base.startsWith(DIST + sep)) return null;
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Serves dist/ like the Worker's ASSETS binding (`/x/` redirects handled, 404 page on a miss). */
async function assets(request) {
  const url = new URL(request.url);
  let file = null;
  try {
    file = resolveFile(url.pathname);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const hit = file ?? join(DIST, '404.html');
  if (!existsSync(hit)) return new Response('Not found', { status: file ? 500 : 404 });
  const headers = new Headers({
    'Content-Type': TYPES[extname(hit)] ?? 'application/octet-stream',
  });
  for (const [name, value] of headersFor(rules, url.pathname)) headers.set(name, value);
  if (!headers.has('cache-control'))
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(hit));
  return new Response(body, { status: file ? 200 : 404, headers });
}

const env = { ...process.env, ASSETS: { fetch: assets }, GIF_LIMITER: LIMITER };
const ctx = {
  waitUntil: (/** @type {Promise<unknown>} */ p) => void p.catch(() => {}),
  passThroughOnException() {},
};

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    const proto = req.headers['x-forwarded-proto'] ?? 'http';
    const request = new Request(
      new URL(req.url ?? '/', `${proto}://${req.headers.host ?? 'localhost'}`),
      {
        method: req.method,
        headers: /** @type {Record<string, string>} */ (req.headers),
      },
    );
    const response = await worker.fetch(request, env, ctx);
    const out = {};
    response.headers.forEach((value, name) => (out[name] = value));
    res.writeHead(response.status, out);
    if (!response.body || req.method === 'HEAD') res.end();
    else Readable.fromWeb(/** @type {any} */ (response.body)).pipe(res);
  } catch (error) {
    console.error('[zkevinly-web]', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

server.listen(PORT, () => console.log(`[zkevinly-web] listening on :${PORT} (serving ${DIST})`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
