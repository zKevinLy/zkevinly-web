// Search → page hand-off. When someone opens an on-site search result, the page they
// land on briefly glows the component that was found. Pure helpers only (no DOM), so
// they're unit-tested; Search.astro does the actual scrolling and class toggling.

import { normalize } from './filter';

export const SPOTLIGHT_KEY = 'search-spotlight';
export const SPOTLIGHT_CLASS = 'is-spotlit';
/** How long the glow class stays on (CSS runs ~2.4s; the rest is a safety margin). */
export const SPOTLIGHT_MS = 3200;

/** Stored for at most this long, so a stale click can't glow something later. */
const MAX_AGE_MS = 15_000;

export interface PendingSpotlight {
  /** Destination path, no trailing slash. */
  path: string;
  /** "#node-foo" or "" when the result points at a whole page. */
  hash: string;
  /** Normalised search terms, used when there's no hash to go on. */
  terms: string[];
  at: number;
}

export const cleanPath = (path: string): string => path.replace(/\/+$/, '') || '/';

export function encodePending(
  target: { pathname: string; hash: string },
  terms: string[],
  now = Date.now(),
): string {
  const pending: PendingSpotlight = {
    path: cleanPath(target.pathname),
    hash: target.hash,
    terms: terms.map(normalize).filter(Boolean),
    at: now,
  };
  return JSON.stringify(pending);
}

/** Parses what `encodePending` wrote. Anything malformed or expired is null. */
export function readPending(raw: string | null, now = Date.now()): PendingSpotlight | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingSpotlight>;
    if (
      typeof value.path !== 'string' ||
      typeof value.hash !== 'string' ||
      typeof value.at !== 'number' ||
      !Array.isArray(value.terms) ||
      !value.terms.every((term) => typeof term === 'string') ||
      now - value.at > MAX_AGE_MS
    ) {
      return null;
    }
    return { path: value.path, hash: value.hash, terms: value.terms, at: value.at };
  } catch {
    return null;
  }
}

export interface Candidate {
  title: string;
  text: string;
}

/**
 * Index of the candidate that best matches every term, or -1 when none does.
 * A title hit beats a body hit; among equals the shorter (more specific) one wins.
 */
export function pickCandidate(candidates: Candidate[], terms: string[]): number {
  const wanted = terms.map(normalize).filter(Boolean);
  if (wanted.length === 0) return -1;

  let best = -1;
  let bestScore = -Infinity;

  candidates.forEach((candidate, index) => {
    const title = normalize(candidate.title);
    const text = normalize(`${candidate.title} ${candidate.text}`);
    if (!wanted.every((term) => text.includes(term))) return;

    const score = wanted.reduce((sum, term) => sum + (title.includes(term) ? 10 : 0), 0);
    const specific = score - text.length / 100_000;
    if (specific > bestScore) {
      best = index;
      bestScore = specific;
    }
  });

  return best;
}
