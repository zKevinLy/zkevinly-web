import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entrySource, pageSources } from '../../../src/lib/ui/filter-sources';
import type { TopicPage } from '../../../src/config/types';

describe('entrySource / pageSources', () => {
  it('derives the repo for GitHub entries', () => {
    const source = entrySource({
      title: 'Nuvio',
      description: 'd',
      href: 'https://github.com/NuvioMedia/NuvioTV',
      tags: ['media'],
    });
    assert.equal(source.repo, 'NuvioMedia/NuvioTV');
    assert.equal(source.title, 'Nuvio');
  });

  const base = { type: 'topic', slug: 's', title: 'T', description: 'D' } as const;

  it('collects children, links and entries but skips text blocks', () => {
    const page: TopicPage = {
      ...base,
      children: [{ ...base, title: 'Child', blocks: [] }],
      blocks: [
        { type: 'text', content: 'hello' },
        {
          type: 'links',
          title: 'L',
          items: [{ title: 'Link', description: 'd', href: 'x', label: 'lbl' }],
        },
        {
          type: 'entries',
          items: [{ title: 'Entry', description: 'd', href: 'https://example.com' }],
        },
        { type: 'steps', title: 'S', items: ['one'] },
      ],
    };
    assert.deepEqual(
      pageSources(page).map((s) => s.title),
      ['Child', 'Link', 'Entry'],
    );
  });

  it('offers nothing on hub pages', () => {
    const hub: TopicPage = {
      ...base,
      hub: true,
      blocks: [{ type: 'entries', items: [{ title: 'E', description: 'd', href: 'x' }] }],
    };
    assert.deepEqual(pageSources(hub), []);
  });
});
