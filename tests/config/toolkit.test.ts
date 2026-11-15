// Keeps the Toolkit config and its pages in sync, so a typo fails CI instead of shipping
// a card that links to nothing.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toolkit, toolHref } from '../../src/config/toolkit';
import { getNavItems } from '../../src/lib/ui/navigation';

describe('toolkit config', () => {
  it('has tools', () => assert.ok(toolkit.tools.length > 0));

  it('has unique, URL-safe slugs', () => {
    const slugs = toolkit.tools.map((tool) => tool.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'duplicate slugs');
    for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  for (const tool of toolkit.tools) {
    describe(tool.title, () => {
      it('has a title and description', () => {
        assert.ok(tool.title.trim());
        assert.ok(tool.description.trim());
      });

      it('has unique, lowercase tags', () => {
        const tags = tool.tags ?? [];
        assert.equal(new Set(tags).size, tags.length, 'duplicate tags');
        for (const tag of tags) assert.equal(tag, tag.toLowerCase().trim());
      });

      it('has a page at src/pages/toolkit/<slug>.astro', () => {
        assert.ok(existsSync(join('src/pages/toolkit', `${tool.slug}.astro`)));
      });

      it('lives under the toolkit path', () => {
        assert.equal(toolHref(tool), `${toolkit.path}/${tool.slug}`);
      });
    });
  }
});

describe('toolkit wiring', () => {
  it('is in the main navigation, after the config-driven pages', () => {
    const items = getNavItems();
    assert.deepEqual(items.at(-1), { href: toolkit.path, label: toolkit.title });
  });

  it('gets a strict CSP that replaces the site-wide one', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    for (const route of [toolkit.path, `${toolkit.path}/*`]) {
      const block = headers.split(/\n(?=\S)/).find((part) => part.startsWith(`${route}\n`));
      assert.ok(block, `no header rule for ${route}`);
      assert.match(block, /^\s+! Content-Security-Policy$/m);
      assert.match(block, /connect-src 'self'/);
      assert.match(block, /default-src 'self'/);
    }
  });
});
