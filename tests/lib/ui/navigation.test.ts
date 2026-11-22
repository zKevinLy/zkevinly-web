import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { site } from '../../../src/config';
import { toolkit } from '../../../src/config/toolkit';
import { getBreadcrumbs, getNavItems } from '../../../src/lib/ui/navigation';

describe('getNavItems', () => {
  it('lists the pages flagged showInNav in config order, then the Toolkit', () => {
    const items = getNavItems();
    const flagged = Object.entries(site.pages)
      .filter(([, page]) => (page as { showInNav?: boolean }).showInNav === true)
      .map(([slug]) => `/${slug}`);
    assert.deepEqual(
      items.map((i) => i.href),
      [...flagged, toolkit.path],
    );
    assert.equal(items.at(-1)!.label, toolkit.title);
  });
});

describe('getBreadcrumbs', () => {
  it('walks the page tree to build one crumb per level', () => {
    const crumbs = getBreadcrumbs('/collections/nuvio/addons');
    assert.deepEqual(
      crumbs.map((c) => c.href),
      ['/collections', '/collections/nuvio', '/collections/nuvio/addons'],
    );
    assert.ok(crumbs.every((c) => c.title.length > 0));
  });
  it('ignores a trailing slash', () => {
    assert.equal(getBreadcrumbs('/collections/nuvio/').length, 2);
  });
  it('stops at the first segment that is not a page', () => {
    assert.deepEqual(
      getBreadcrumbs('/collections/nuvio/nope/deeper').map((c) => c.href),
      ['/collections', '/collections/nuvio'],
    );
  });
  it('is empty for the home page and unknown pages', () => {
    assert.deepEqual(getBreadcrumbs('/'), []);
    assert.deepEqual(getBreadcrumbs('/nowhere'), []);
  });
  it('does not descend into a page that is not a topic', () => {
    const crumbs = getBreadcrumbs('/projects/anything');
    assert.deepEqual(
      crumbs.map((c) => c.href),
      ['/projects'],
    );
  });
});
