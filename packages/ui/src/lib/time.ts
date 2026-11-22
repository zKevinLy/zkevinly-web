// Pure time helpers used by <Freshness>. No Node-only APIs: runs at build time and in the browser.

export type Freshness = 'hot' | 'warm' | 'cold';

/** "3 days ago", "in 2 hours", "just now". */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];

  // `abs` is at least 60 here, so the last unit (minutes) always matches.
  const [unit, size] = units.find(([, size]) => abs >= size)!;
  return rtf.format(Math.round(seconds / size), unit);
}

/** hot = touched in the last 2 weeks (pulses), warm = last 3 months, else cold. */
export function freshness(iso: string, now = Date.now()): Freshness {
  const days = (now - new Date(iso).getTime()) / 86_400_000;
  if (days <= 14) return 'hot';
  if (days <= 90) return 'warm';
  return 'cold';
}
