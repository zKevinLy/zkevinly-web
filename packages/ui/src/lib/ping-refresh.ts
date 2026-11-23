// Browser-side: keeps every status dot fresh. The package owns the loop (find the cards, one check
// per distinct target, paint, repeat while the tab is visible, stop on page swaps); the app supplies
// only `check(url)`: what to ask and who asks (a Worker endpoint, the container, the visitor's own
// browser). Cards are found by `[data-ping-url]` and painted through their `.node-ping` dot.

import { applyPing, type PingInput, type PingResult } from './ping';

export interface PingRefreshOptions {
  /** Checks one target. `card` is the first card showing it, for per-card settings. */
  check: (url: string, card: HTMLElement) => Promise<PingInput>;
  /** Cards that share a key share one check (default: the URL). Add anything that changes `check`. */
  key?: (url: string, card: HTMLElement) => string;
  /** Default 60 s. */
  intervalMs?: number;
}

/** Asks an endpoint (`GET <endpoint>?url=...` answering `{ up, ms? }`); anything else is "unknown". */
export function pingViaEndpoint(endpoint: string) {
  return async (url: string): Promise<PingInput> => {
    try {
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
      if (!res.ok) return 'unknown';
      const body = (await res.json()) as Partial<PingResult>;
      return typeof body.up === 'boolean' ? { up: body.up, ms: body.ms } : 'unknown';
    } catch {
      return 'unknown';
    }
  };
}

/**
 * Asks from the visitor's own browser (no-cors): the only way to reach LAN hosts. The response is
 * opaque, so it says "something answered" and how long it took, not the status. Any failure reads
 * as down.
 */
export function pingViaBrowser(timeoutMs = 5_000) {
  return async (url: string): Promise<PingInput> => {
    const started = performance.now();
    try {
      await fetch(url, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { up: true, ms: performance.now() - started };
    } catch {
      return { up: false };
    }
  };
}

export function startPingRefresh({ check, key, intervalMs = 60_000 }: PingRefreshOptions) {
  async function refresh() {
    const groups = new Map<string, { url: string; card: HTMLElement; dots: HTMLElement[] }>();
    for (const card of document.querySelectorAll<HTMLElement>('[data-ping-url]')) {
      const dot = card.querySelector<HTMLElement>('.node-ping');
      const url = card.dataset.pingUrl;
      if (!dot || !url) continue;
      const id = key?.(url, card) ?? url;
      const group = groups.get(id) ?? { url, card, dots: [] };
      group.dots.push(dot);
      groups.set(id, group);
    }
    await Promise.all(
      [...groups.values()].map(async ({ url, card, dots }) => {
        const result = await check(url, card);
        for (const dot of dots) applyPing(dot, result);
      }),
    );
  }

  let timer: number | undefined;
  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
  };
  const start = () => {
    stop();
    if (!document.querySelector('[data-ping-url]')) return;
    void refresh();
    // A background tab isn't worth the requests.
    timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, intervalMs);
  };

  document.addEventListener('astro:page-load', start);
  document.addEventListener('astro:before-swap', stop);
  return stop;
}
