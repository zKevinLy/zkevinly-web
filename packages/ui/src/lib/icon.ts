// Turns the `icon` string on a Node into something renderable. Homepage-style: one string, several
// forms, so a card only needs `icon: 'si-github'` or `icon: 'jellyfin.svg'`.
//
//   si-<slug>            a Simple Icons brand glyph, inlined as an SVG (si-github, si-cloudflare)
//   <name>.svg|png|webp  a Dashboard Icons file (https://github.com/homarr-labs/dashboard-icons),
//                        served by jsDelivr: jellyfin.svg, sonarr.png
//   /path, ./path        an image on this site (put it in public/)
//   https://...          any image URL
//   data:image/...       an inlined image
//
// Pure and build-time: no DOM, no network. An unknown form or Simple Icons slug throws, so a typo
// in a config file fails the build instead of shipping a card with a broken or missing icon.

import * as simpleIcons from 'simple-icons';

export type IconSpec =
  /** An image file: rendered as <img>. */
  | { kind: 'img'; src: string }
  /** A single-path 24x24 glyph: rendered inline so it takes the text colour. */
  | { kind: 'svg'; path: string; title: string };

/** Base URL for Dashboard Icons (jsDelivr's mirror of homarr-labs/dashboard-icons). */
export const DASHBOARD_ICONS = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

type Glyph = { slug: string; title: string; path: string };

let glyphs: Map<string, Glyph> | undefined;

/** Simple Icons keyed by slug, built on first use. */
function glyphBySlug(slug: string): Glyph | undefined {
  if (!glyphs) {
    glyphs = new Map();
    for (const value of Object.values(simpleIcons) as unknown[]) {
      if (value && typeof value === 'object') {
        const g = value as Partial<Glyph>;
        if (
          typeof g.slug === 'string' &&
          typeof g.path === 'string' &&
          typeof g.title === 'string'
        ) {
          glyphs.set(g.slug, g as Glyph);
        }
      }
    }
  }
  return glyphs.get(slug);
}

const IMAGE_URL = /^(?:https?:\/\/|\/|\.\/|data:image\/)/i;
const DASHBOARD_NAME = /^[a-z0-9][a-z0-9-]*\.(svg|png|webp)$/i;

/** What to render for an `icon` value, or null when it is empty. Throws on a value it can't place. */
export function resolveIcon(spec: string | undefined | null): IconSpec | null {
  const value = spec?.trim();
  if (!value) return null;

  if (/^si-/i.test(value)) {
    const slug = value.slice(3).toLowerCase();
    const glyph = glyphBySlug(slug);
    if (!glyph) throw new Error(`Unknown Simple Icons slug "${slug}" in icon "${value}".`);
    return { kind: 'svg', path: glyph.path, title: glyph.title };
  }

  if (IMAGE_URL.test(value)) return { kind: 'img', src: value };

  const named = DASHBOARD_NAME.exec(value);
  if (named) {
    return {
      kind: 'img',
      src: `${DASHBOARD_ICONS}/${named[1].toLowerCase()}/${value.toLowerCase()}`,
    };
  }

  throw new Error(
    `Unrecognised icon "${value}". Use si-<slug>, <name>.svg|png|webp, a /path, or an image URL.`,
  );
}
