import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_ICONS, resolveIcon } from '../src/lib/icon';

describe('resolveIcon', () => {
  it('returns null for nothing', () => {
    for (const v of [undefined, null, '', '   ']) assert.equal(resolveIcon(v), null);
  });

  it('resolves si-<slug> to the Simple Icons glyph, ignoring case', () => {
    for (const v of ['si-github', 'SI-GitHub']) {
      const icon = resolveIcon(v);
      assert.equal(icon?.kind, 'svg');
      if (icon?.kind === 'svg') {
        assert.equal(icon.title, 'GitHub');
        assert.match(icon.path, /^[Mm]/);
      }
    }
  });

  it('throws for a Simple Icons slug that does not exist, naming it', () => {
    assert.throws(() => resolveIcon('si-definitely-not-a-brand'), /definitely-not-a-brand/);
  });

  it('keeps site paths, relative paths, URLs and data images as they are', () => {
    for (const src of [
      '/logo.png',
      './logo.png',
      'https://example.com/a.svg',
      'http://nas.local/a.png',
      'data:image/svg+xml;base64,AAAA',
    ]) {
      assert.deepEqual(resolveIcon(src), { kind: 'img', src });
    }
  });

  it('maps <name>.svg|png|webp to Dashboard Icons, in the folder for its format', () => {
    assert.deepEqual(resolveIcon('jellyfin.svg'), {
      kind: 'img',
      src: `${DASHBOARD_ICONS}/svg/jellyfin.svg`,
    });
    assert.deepEqual(resolveIcon('Sonarr.PNG'), {
      kind: 'img',
      src: `${DASHBOARD_ICONS}/png/sonarr.png`,
    });
    assert.equal(
      (resolveIcon('nextcloud-calendar.webp') as { src: string }).src,
      `${DASHBOARD_ICONS}/webp/nextcloud-calendar.webp`,
    );
  });

  it('rejects anything else, so a typo fails the build', () => {
    for (const v of ['jellyfin', 'javascript:alert(1)', 'bad name.png', 'mdi-home', '../x.png']) {
      assert.throws(() => resolveIcon(v), /Unrecognised icon/, v);
    }
  });
});
