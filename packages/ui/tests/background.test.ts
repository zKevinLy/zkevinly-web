import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BLUR_STEPS, resolveBackground } from '../src/lib/background';

describe('resolveBackground', () => {
  it('returns null without options or without an image', () => {
    for (const v of [undefined, null, {}, { image: '' }, { image: '   ', blur: 'md' as const }]) {
      assert.equal(resolveBackground(v), null);
    }
  });

  it('with only an image sets just the image, so the CSS defaults apply', () => {
    assert.deepEqual(resolveBackground({ image: ' https://example.com/a.jpg ' }), {
      layer: '--bg-image:url("https://example.com/a.jpg")',
      cards: '',
    });
  });

  it('turns every option into a custom property', () => {
    assert.deepEqual(
      resolveBackground({
        image: '/wall.jpg',
        blur: 'md',
        saturate: 150,
        brightness: 50,
        opacity: 40,
        cardBlur: 8,
        cardOpacity: 70,
      }),
      {
        layer:
          '--bg-image:url("/wall.jpg");--bg-blur:12px;--bg-saturate:150%;--bg-brightness:50%;--bg-opacity:0.4',
        cards: '--card-blur:8px;--card-opacity:70%',
      },
    );
  });

  it('knows Homepage blur names and takes a number of px', () => {
    for (const [name, px] of Object.entries(BLUR_STEPS)) {
      const r = resolveBackground({ image: '/a.jpg', blur: name as keyof typeof BLUR_STEPS });
      assert.match(r?.layer ?? '', new RegExp(`--bg-blur:${px}px`));
    }
    assert.match(resolveBackground({ image: '/a.jpg', blur: 7 })?.layer ?? '', /--bg-blur:7px/);
    assert.match(resolveBackground({ image: '/a.jpg', blur: 0 })?.layer ?? '', /--bg-blur:0px/);
  });

  it('accepts site paths, relative paths, http(s) and data images', () => {
    for (const image of [
      '/a.jpg',
      './a.jpg',
      'https://example.com/a.jpg',
      'http://nas.local/a.png',
      'data:image/png;base64,AAAA',
    ]) {
      assert.ok(resolveBackground({ image })?.layer.startsWith('--bg-image:url("'));
    }
  });

  it('rejects anything else, and control characters', () => {
    for (const image of ['javascript:alert(1)', 'wall.jpg', 'ftp://x/a.jpg', 'https://x/a\n.jpg']) {
      assert.throws(() => resolveBackground({ image }), /Unrecognised background image/);
    }
  });

  it('encodes what could end the CSS url early', () => {
    const r = resolveBackground({ image: 'https://x/a b".jpg?x=(1)&y=<2>\\z' });
    assert.equal(
      r?.layer,
      '--bg-image:url("https://x/a%20b%22.jpg?x=%281%29&y=%3C2%3E%5Cz")',
    );
  });

  it('fails on a value it cannot place, naming the option', () => {
    const bad = (o: Record<string, unknown>) =>
      resolveBackground({ image: '/a.jpg', ...o } as Parameters<typeof resolveBackground>[0]);
    assert.throws(() => bad({ blur: 'huge' }), /blur "huge" is not one of none, sm/);
    assert.throws(() => bad({ blur: 'toString' }), /blur "toString"/);
    assert.throws(() => bad({ cardBlur: 'huge' }), /cardBlur "huge"/);
    assert.throws(() => bad({ blur: -1 }), /blur must be a number from 0 to 200/);
    assert.throws(() => bad({ blur: 201 }), /blur must be/);
    assert.throws(() => bad({ saturate: 501 }), /saturate must be a number from 0 to 500/);
    assert.throws(() => bad({ brightness: -5 }), /brightness must be/);
    assert.throws(() => bad({ opacity: 101 }), /opacity must be a number from 0 to 100/);
    assert.throws(() => bad({ cardOpacity: 101 }), /cardOpacity must be/);
    assert.throws(() => bad({ opacity: '50' }), /opacity must be/);
    assert.throws(() => bad({ saturate: Number.NaN }), /saturate must be/);
  });
});
