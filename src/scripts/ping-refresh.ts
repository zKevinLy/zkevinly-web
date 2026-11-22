// Browser: keeps every card's status dot (`[data-ping-url]`, from EntryCard) fresh. The UI package
// knows how to paint a result (applyPing); what to check and who asks is this site's business.
//
//  - via the Worker (default): GET /api/ping, which asks from Cloudflare. Public hosts only.
//  - via the browser: a no-cors request from the visitor's own browser, the only way to reach
//    LAN / homelab hosts. A no-cors response is opaque, so it can say "something answered" and how
//    long it took, but not the status code. Any failure (offline, refused, timeout, blocked as
//    mixed content) reads as down.

import { applyPing, type PingInput, type PingResult } from '@zkevinly/ui/lib/ping';

const INTERVAL_MS = 60_000;
const TIMEOUT_MS = 5_000;

async function viaWorker(url: string): Promise<PingInput> {
  try {
    const res = await fetch(`/api/ping?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const body = (await res.json()) as Partial<PingResult>;
    return typeof body.up === 'boolean' ? { up: body.up, ms: body.ms } : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function viaBrowser(url: string): Promise<PingInput> {
  const started = performance.now();
  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { up: true, ms: performance.now() - started };
  } catch {
    return { up: false };
  }
}

async function refresh() {
  // One request per distinct target, however many cards show it.
  const groups = new Map<string, { url: string; via: string; dots: HTMLElement[] }>();
  for (const card of document.querySelectorAll<HTMLElement>('[data-ping-url]')) {
    const dot = card.querySelector<HTMLElement>('.node-ping');
    const url = card.dataset.pingUrl;
    if (!dot || !url) continue;
    const via = card.dataset.pingVia === 'browser' ? 'browser' : 'worker';
    const group = groups.get(`${via} ${url}`) ?? { url, via, dots: [] };
    group.dots.push(dot);
    groups.set(`${via} ${url}`, group);
  }

  await Promise.all(
    [...groups.values()].map(async ({ url, via, dots }) => {
      const result = via === 'browser' ? await viaBrowser(url) : await viaWorker(url);
      for (const dot of dots) applyPing(dot, result);
    }),
  );
}

let timer: number | undefined;

function stop() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

function start() {
  stop();
  if (!document.querySelector('[data-ping-url]')) return;
  void refresh();
  // Re-check while the tab is open and visible; a background tab isn't worth the requests.
  timer = window.setInterval(() => {
    if (!document.hidden) void refresh();
  }, INTERVAL_MS);
}

document.addEventListener('astro:page-load', start);
document.addEventListener('astro:before-swap', stop);
