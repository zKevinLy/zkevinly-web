import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { childSections } from '../../src/lib/groups';
import type { TopicPage } from '../../src/config/types';

const page = (slug: string, group?: string): TopicPage => ({
  type: 'topic',
  slug,
  title: slug.toUpperCase(),
  description: slug,
  group,
  blocks: [],
});

const parent = (children: TopicPage[], groups?: TopicPage['groups']): TopicPage => ({
  type: 'topic',
  slug: 'parent',
  title: 'Parent',
  description: 'parent',
  groups,
  blocks: [],
  children,
});

describe('childSections', () => {
  it('returns nothing when there are no children', () => {
    assert.deepEqual(childSections(parent([])), []);
  });

  it('uses a single "Explore" section when the page has no groups', () => {
    const sections = childSections(parent([page('a'), page('b')]));
    assert.equal(sections.length, 1);
    assert.equal(sections[0].title, 'Explore Parent');
    assert.deepEqual(
      sections[0].pages.map((p) => p.slug),
      ['a', 'b'],
    );
  });

  it('splits children into their groups, in the order the groups are declared', () => {
    const sections = childSections(
      parent(
        [page('nuvio', 'guides'), page('tv', 'collections'), page('alt', 'collections')],
        [
          { id: 'collections', title: 'Collections' },
          { id: 'guides', title: 'Guides', description: 'Walkthroughs' },
        ],
      ),
    );

    assert.deepEqual(
      sections.map((s) => [s.title, s.pages.map((p) => p.slug)]),
      [
        ['Collections', ['tv', 'alt']],
        ['Guides', ['nuvio']],
      ],
    );
    assert.equal(sections[1].note, 'Walkthroughs');
  });

  it('skips groups that have no pages', () => {
    const sections = childSections(
      parent([page('a', 'one')], [
        { id: 'one', title: 'One' },
        { id: 'two', title: 'Two' },
      ]),
    );
    assert.deepEqual(
      sections.map((s) => s.id),
      ['one'],
    );
  });

  it('fails when a child is in an unknown group', () => {
    assert.throws(
      () => childSections(parent([page('a', 'nope')], [{ id: 'one', title: 'One' }])),
      /"A" \(group: nope\)/,
    );
  });

  it('fails when a child has no group but its parent defines groups', () => {
    assert.throws(
      () => childSections(parent([page('a')], [{ id: 'one', title: 'One' }])),
      /group: none/,
    );
  });

  it('shows a group that only has entry cards, after its pages', () => {
    const entry = { title: 'Repo', description: 'd', href: 'https://github.com/a/b' };
    const sections = childSections(
      parent([page('a', 'one')], [
        { id: 'one', title: 'One', entries: [entry] },
        { id: 'two', title: 'Two', entries: [entry] },
        { id: 'three', title: 'Three' },
      ]),
    );
    assert.deepEqual(
      sections.map((s) => [s.id, s.pages.length, s.entries.length]),
      [
        ['one', 1, 1],
        ['two', 0, 1],
      ],
    );
  });
});
