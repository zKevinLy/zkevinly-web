// Which entries get a ping, and what exactly is checked. Shared by the build (EntryCard), the Worker
// (/api/ping only checks what is listed here) and the browser (scripts/ping-refresh.ts). Keep this
// file free of Node-only APIs.

import type { Entry, EntryPing, SitePage } from '../config/types';

export type PingVia = 'worker' | 'browser';

export interface PingTarget {
  /** Normalised http(s) URL that is checked. */
  url: string;
  via: PingVia;
}

/** A valid http(s) URL without its #fragment, or null. The same string everywhere, so the Worker's allow-list matches. */
export function normalizePingUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** What to check for an entry, or null when it has no (valid) ping. */
export function entryPing(entry: Pick<Entry, 'href' | 'ping'>): PingTarget | null {
  if (!entry.ping) return null;
  const config: EntryPing = entry.ping === true ? {} : entry.ping;
  const url = normalizePingUrl(config.url ?? entry.href);
  if (!url) return null;
  return { url, via: config.via === 'browser' ? 'browser' : 'worker' };
}

/** Every entry reachable from a page: its list, its blocks, its groups and its child pages. */
export function pageEntries(page: SitePage): Entry[] {
  if (page.type === 'directory') return page.items;
  return [
    ...page.blocks.flatMap((block) => (block.type === 'entries' ? block.items : [])),
    ...(page.groups ?? []).flatMap((group) => group.entries ?? []),
    ...(page.children ?? []).flatMap(pageEntries),
  ];
}

/** The distinct things the site pings. */
export function collectPingTargets(pages: SitePage[]): PingTarget[] {
  const seen = new Map<string, PingTarget>();
  for (const entry of pages.flatMap(pageEntries)) {
    const target = entryPing(entry);
    if (target) seen.set(`${target.via} ${target.url}`, target);
  }
  return [...seen.values()];
}
