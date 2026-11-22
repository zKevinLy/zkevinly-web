import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFilterModel,
  filterAttrs,
  parseQuery,
  sortOrder,
  type FilterSource,
} from '../../packages/ui/src/lib/filter';
import { findWorkflowIssues, layoutWorkflow } from '../../packages/ui/src/lib/workflow';
import { relativeTime } from '../../packages/ui/src/lib/time';
import { childSections } from '../../src/lib/topics/groups';
import { pageSources } from '../../src/lib/ui/filter-sources';
import { getReply } from '../../src/lib/ui/chatbot';
import type { TopicPage } from '../../src/config';
import { searchGifs } from '../../worker/giphy.js';

describe('filter odds and ends', () => {
  it('a query made only of empty quotes matches everything', () => {
    assert.deepEqual(parseQuery('""'), []);
    assert.deepEqual(parseQuery('tag:""'), []);
  });

  it('titles that differ only by case keep their original order', () => {
    const item = (title: string) => ({ title, text: '', tags: [], updated: null, stars: null });
    assert.deepEqual(
      sortOrder([item('apple'), item('Apple'), item('APPLE'), item('Aardvark')], 'title'),
      [3, 0, 1, 2],
    );
  });

  it('works for sources without tags', () => {
    const source: FilterSource = { title: 'No tags' };
    assert.deepEqual(filterAttrs(source)['data-filter-tags'] ?? '', '');
    assert.equal(buildFilterModel([source, { title: 'Two' }], { force: true })?.tags.length, 0);
  });
});

describe('time', () => {
  it('rounds to the biggest whole unit', () => {
    assert.equal(relativeTime(new Date(Date.now() - 60_000).toISOString()), '1 minute ago');
    assert.equal(relativeTime(new Date(Date.now() - 59_000).toISOString()), 'just now');
  });
});

describe('workflow without dependants', () => {
  it('gives a step that nothing depends on an empty unlock list', () => {
    const phases = [{ id: 'p', title: 'P' }];
    const nodes = [{ id: 'a', phase: 'p', title: 'A', description: 'a' }];
    assert.deepEqual(findWorkflowIssues(nodes as never, phases), []);
    assert.deepEqual(layoutWorkflow(nodes as never, phases).nodes[0].unlocks, []);
  });
});

describe('pages without children', () => {
  const page = (over: Partial<TopicPage>): TopicPage => ({
    type: 'topic',
    slug: 's',
    title: 'S',
    description: 'd',
    blocks: [],
    ...over,
  });
  it('have no sections', () => {
    assert.deepEqual(childSections(page({})), []);
  });
  it('have no filter sources from children', () => {
    assert.deepEqual(pageSources(page({})), []);
  });
  it('list link cards and group entries, and skip hubs and text', () => {
    const entry = { title: 'E', description: 'e', href: 'https://example.com/', tags: ['x'] };
    const sources = pageSources(
      page({
        blocks: [
          {
            type: 'links',
            items: [{ title: 'L', description: 'l', label: 'Open', href: '/x', tags: ['y'] }],
          },
          { type: 'text', content: 'ignored' },
        ],
        groups: [
          { id: 'g', title: 'G', entries: [entry] },
          { id: 'empty', title: 'Empty' },
        ],
        children: [page({ slug: 'kid', title: 'Kid', tags: ['z'] })],
      } as never),
    );
    assert.deepEqual(
      sources.map((s) => s.title),
      ['Kid', 'E', 'L'],
    );
    assert.equal(sources[2].label, 'Open');
    assert.deepEqual(pageSources(page({ hub: true, children: [page({})] })), []);
  });
});

describe('the chat bot', () => {
  it('echoes up to three emoji from what was sent', () => {
    const brain = { rules: [], question: [{ emoji: '?' }], fallback: [{ emoji: '.' }] };
    assert.equal(getReply('great 😀😀😀😀', brain).emoji, '😀😀😀❗');
    assert.equal(getReply('just words', brain).emoji, '.');
  });
});

describe('GIPHY titles', () => {
  it('uses the search words when a GIF has a blank title', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ title: '   ', images: { fixed_width: { url: 'https://media.giphy.com/a.gif' } } }],
      }),
    });
    const out = await searchGifs({ query: 'happy dance', key: 'k', fetchImpl: fetchImpl as never });
    assert.equal(out[0].title, 'happy dance');
  });
});
