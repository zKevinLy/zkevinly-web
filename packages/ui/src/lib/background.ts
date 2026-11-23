// Turns the `background` option of the Layout into CSS custom properties. Homepage-style: one
// image URL plus a few knobs (blur, saturate, brightness, opacity) for the picture, and cardBlur /
// cardOpacity so the cards sitting on top of it stay readable.
//
//   image        /path, ./path, https://..., data:image/...   (nothing else: it ends up in CSS)
//   blur         none | sm | md | lg | xl | 2xl | 3xl, or a number of px     (Homepage's names)
//   saturate     percent, 100 = unchanged
//   brightness   percent, 100 = unchanged
//   opacity      0-100: how much of the image shows over the page colour
//   cardBlur     like `blur`, applied behind each card (Node)
//   cardOpacity  0-100: how solid a card's surface is, so the image can show through
//
// Pure and build-time: no DOM, no network. An unknown value throws, so a typo in a config file
// fails the build instead of shipping a page with a silently missing background.

export const BLUR_STEPS = {
  none: 0,
  sm: 4,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 40,
  '3xl': 64,
} as const;

export type BlurStep = keyof typeof BLUR_STEPS;

export interface BackgroundOptions {
  /** Image to show behind the whole site. Without one there is no background. */
  image?: string;
  blur?: BlurStep | number;
  /** Percent; 100 leaves the colours as they are. */
  saturate?: number;
  /** Percent; 100 leaves the image as it is. */
  brightness?: number;
  /** 0-100. */
  opacity?: number;
  cardBlur?: BlurStep | number;
  /** 0-100. */
  cardOpacity?: number;
}

export interface ResolvedBackground {
  /** Inline style for the image layer: the image and its filters. */
  layer: string;
  /** Inline style for <html>: what the cards read (empty when no card option is set). */
  cards: string;
}

const IMAGE_URL = /^(?:https?:\/\/|\/|\.\/|data:image\/)/i;
// eslint-disable-next-line no-control-regex -- the point is to reject them
const CONTROL = /[\u0000-\u001f\u007f]/;

function range(name: string, value: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      `background ${name} must be a number from ${min} to ${max}, got ${String(value)}.`,
    );
  }
  return value;
}

function blurPx(name: string, value: BlurStep | number): number {
  if (typeof value === 'string') {
    if (!Object.hasOwn(BLUR_STEPS, value)) {
      throw new Error(
        `background ${name} "${value}" is not one of ${Object.keys(BLUR_STEPS).join(', ')} (or a number of px).`,
      );
    }
    return BLUR_STEPS[value];
  }
  return range(name, value, 0, 200);
}

const URL_ESCAPES: Record<string, string> = {
  '\\': '%5C',
  '"': '%22',
  '(': '%28',
  ')': '%29',
  '<': '%3C',
  '>': '%3E',
};

/** A CSS `url("...")`: quotes, brackets and whitespace encoded so the value can't end early. */
function cssUrl(image: string): string {
  const encoded = image.replace(/[\\"()<>\s]/g, (c) => URL_ESCAPES[c] ?? encodeURIComponent(c));
  return `url("${encoded}")`;
}

const declarations = (entries: [string, string | undefined][]) =>
  entries
    .filter((e): e is [string, string] => e[1] !== undefined)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

/** What to render for a `background` option, or null when it has no image. */
export function resolveBackground(
  options: BackgroundOptions | undefined | null,
): ResolvedBackground | null {
  if (!options) return null;
  const image = options.image?.trim();
  if (!image) return null;

  if (!IMAGE_URL.test(image) || CONTROL.test(image)) {
    throw new Error(
      `Unrecognised background image "${image}". Use a /path, ./path, https:// URL or data:image/ URL.`,
    );
  }

  const { blur, saturate, brightness, opacity, cardBlur, cardOpacity } = options;
  const px = (name: string, v: BlurStep | number | undefined) =>
    v === undefined ? undefined : `${blurPx(name, v)}px`;
  const pct = (name: string, v: number | undefined, max: number) =>
    v === undefined ? undefined : `${range(name, v, 0, max)}%`;

  const layer = declarations([
    ['--bg-image', cssUrl(image)],
    ['--bg-blur', px('blur', blur)],
    ['--bg-saturate', pct('saturate', saturate, 500)],
    ['--bg-brightness', pct('brightness', brightness, 500)],
    [
      '--bg-opacity',
      opacity === undefined ? undefined : String(range('opacity', opacity, 0, 100) / 100),
    ],
  ]);
  const cards = declarations([
    ['--card-blur', px('cardBlur', cardBlur)],
    ['--card-opacity', pct('cardOpacity', cardOpacity, 100)],
  ]);
  return { layer, cards };
}
