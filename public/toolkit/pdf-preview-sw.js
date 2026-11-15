// Serves the PDF preview from a real-looking URL (/toolkit/pdf/preview/<name>.pdf) so the
// browser's built-in viewer saves it under that name instead of a random blob ID.
// The bytes arrive from the page by postMessage and live only in this worker's memory:
// nothing is written to the Cache API, IndexedDB or disk, and nothing touches the network.
//
// Each tab picks its own random preview id, so two open tabs can never read each other's
// document. A tab tells the worker to drop its previews when it closes, and anything left
// behind (a crash, a killed tab) is discarded after MAX_AGE_MS.

const PREFIX = '/toolkit/pdf/preview/';
const KEEP = 3; // versions kept per tab: the one on screen plus the one being swapped in
const MAX_AGE_MS = 10 * 60 * 1000;
const ID = /^[a-z0-9-]{8,64}$/;

/** "<tab id>:<version>" -> { bytes, at } */
const previews = new Map();

const prune = () => {
  const now = Date.now();
  for (const [key, entry] of previews) if (now - entry.at > MAX_AGE_MS) previews.delete(key);
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const { id, v, bytes, clear } = event.data || {};
  if (typeof id !== 'string' || !ID.test(id)) return;

  if (clear === true) {
    for (const key of [...previews.keys()]) if (key.startsWith(`${id}:`)) previews.delete(key);
    return;
  }
  if (typeof v !== 'number' || !(bytes instanceof ArrayBuffer)) return;

  prune();
  previews.set(`${id}:${v}`, { bytes, at: Date.now() });
  for (const key of [...previews.keys()]) {
    if (!key.startsWith(`${id}:`)) continue;
    if (Number(key.slice(id.length + 1)) <= v - KEEP) previews.delete(key);
  }
  if (event.ports[0]) event.ports[0].postMessage('ok');
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return;
  prune();
  const entry = previews.get(`${url.searchParams.get('id')}:${url.searchParams.get('v')}`);
  event.respondWith(
    entry
      ? new Response(entry.bytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      : new Response('This preview has expired.', { status: 404 }),
  );
});
