// Sanity checks on the site content, so a typo in a config file fails CI instead of
// shipping a broken card.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import collections from '../../src/config/collections';
import androidTv from '../../src/config/collections/android-tv';
import nuvio from '../../src/config/collections/nuvio';
import { childSections } from '../../src/lib/groups';
import projects from '../../src/config/projects';
import resources from '../../src/config/resources';
import { entryRepo } from '../../src/lib/github';
import { remoteScriptUrl } from '../../src/lib/commands';
import type { Entry, SitePage, TopicPage } from '../../src/config/types';

/** Every entry reachable from a page, with where it lives (for readable failures). */
function collectEntries(page: SitePage, where = page.title): { entry: Entry; where: string }[] {
  if (page.type === 'directory') return page.items.map((entry) => ({ entry, where }));

  const own = page.blocks.flatMap((block) =>
    block.type === 'entries' ? block.items.map((entry) => ({ entry, where })) : [],
  );
  const grouped = (page.groups ?? []).flatMap((group) =>
    (group.entries ?? []).map((entry) => ({ entry, where: `${where} > ${group.title}` })),
  );
  const nested = (page.children ?? []).flatMap((child) =>
    collectEntries(child, `${where} > ${child.title}`),
  );
  return [...own, ...grouped, ...nested];
}

function collectTopics(page: TopicPage): TopicPage[] {
  return [page, ...(page.children ?? []).flatMap(collectTopics)];
}

const pages: SitePage[] = [projects, resources, collections];
const all = pages.flatMap((page) => collectEntries(page));

describe('site content', () => {
  it('has entries to check', () => assert.ok(all.length > 0));

  for (const { entry, where } of all) {
    describe(`${where}: ${entry.title}`, () => {
      it('has a title and description', () => {
        assert.ok(entry.title.trim());
        assert.ok(entry.description.trim());
      });

      it('links to a valid http(s) URL', () => {
        const url = new URL(entry.href);
        assert.ok(['http:', 'https:'].includes(url.protocol));
      });

      it('has unique, lowercase tags', () => {
        const tags = entry.tags ?? [];
        assert.equal(new Set(tags).size, tags.length, 'duplicate tags');
        for (const tag of tags) assert.equal(tag, tag.toLowerCase().trim());
      });

      it('has enough tags to describe it', () => {
        assert.ok((entry.tags ?? []).length >= 4, `only ${(entry.tags ?? []).length} tags`);
      });

      it('has a valid repo override, if any', () => {
        if (typeof entry.repo === 'string') assert.match(entry.repo, /^[\w.-]+\/[\w.-]+$/);
      });

      it('has well-formed commands, if any', () => {
        for (const { command } of entry.commands ?? []) assert.ok(command.trim());
      });
    });
  }

  it('keeps entry titles unique within each page', () => {
    for (const page of pages) {
      for (const topic of page.type === 'topic' ? collectTopics(page) : [page]) {
        const titles = collectEntries(topic).map(({ entry }) => entry.title);
        assert.equal(new Set(titles).size, titles.length, `duplicate titles on "${topic.title}"`);
      }
    }
  });

  it('keeps sibling topic slugs unique', () => {
    for (const topic of pages
      .filter((p): p is TopicPage => p.type === 'topic')
      .flatMap(collectTopics)) {
      const slugs = (topic.children ?? []).map((child) => child.slug);
      assert.equal(new Set(slugs).size, slugs.length, `duplicate slugs under "${topic.title}"`);
    }
  });

  it('only uses remote-script commands that point at a URL we can show', () => {
    for (const { entry } of all) {
      for (const { command } of entry.commands ?? []) {
        if (/\|\s*(iex|sh|bash)\b/i.test(command)) {
          assert.ok(
            remoteScriptUrl(command),
            `"${command}" pipes into a shell but no script URL was detected`,
          );
        }
      }
    }
  });
});

describe('topic pages', () => {
  const topics = collectTopics(collections);

  it('tags every child page and link', () => {
    for (const topic of topics) {
      for (const child of topic.children ?? []) {
        assert.ok((child.tags ?? []).length > 0, `${topic.title} > ${child.title} has no tags`);
      }
      for (const block of topic.blocks) {
        if (block.type === 'links') {
          for (const link of block.items) {
            assert.ok((link.tags ?? []).length > 0, `${topic.title} > ${link.title} has no tags`);
          }
        }
        if (block.type === 'workflow') {
          for (const node of block.nodes) {
            assert.ok((node.tags ?? []).length > 0, `step ${node.id} has no tags`);
          }
        }
      }
    }
  });

  it('keeps tags unique and lowercase on every node', () => {
    const check = (tags: string[] = [], where: string) => {
      assert.equal(new Set(tags).size, tags.length, `duplicate tags on ${where}`);
      for (const tag of tags) assert.equal(tag, tag.toLowerCase().trim(), `${where}: "${tag}"`);
    };
    for (const topic of topics) {
      check(topic.tags, topic.title);
      for (const block of topic.blocks) {
        if (block.type === 'links') block.items.forEach((l) => check(l.tags, l.title));
        if (block.type === 'workflow') block.nodes.forEach((n) => check(n.tags, n.id));
      }
    }
  });

  it('points related buttons and internal links at pages that exist', () => {
    const known = new Set<string>();
    const walk = (page: TopicPage, path: string) => {
      known.add(path);
      for (const child of page.children ?? []) walk(child, `${path}/${child.slug}`);
    };
    walk(collections, '/collections');

    const internal = (href: string) => href.replace(/[?#].*$/, '').replace(/\/$/, '');
    for (const { entry, where } of all) {
      for (const link of entry.related ?? []) {
        assert.ok(link.title.trim(), `${where}: ${entry.title} has an empty related title`);
        if (link.href.startsWith('/')) {
          assert.ok(known.has(internal(link.href)), `${where}: ${link.href} is not a page`);
        }
      }
    }
    for (const topic of topics) {
      for (const block of topic.blocks) {
        if (block.type !== 'workflow') continue;
        for (const node of block.nodes) {
          for (const href of [node.href, ...(node.links ?? []).map((l) => l.href)]) {
            if (href?.startsWith('/')) {
              assert.ok(known.has(internal(href)), `step ${node.id}: ${href} is not a page`);
            }
          }
        }
      }
    }
  });
});

describe('Android TV page', () => {
  const apps = androidTv.blocks.find((b) => b.type === 'entries');
  const items = apps?.type === 'entries' ? apps.items : [];

  it('lists GitHub-backed apps so version/stars can be shown', () => {
    assert.ok(items.length > 0);
    for (const entry of items)
      assert.ok(entryRepo(entry), `${entry.title} has no resolvable GitHub repo`);
  });

  it('links Nuvio to its setup guide', () => {
    const nuvio = items.find((e) => e.title === 'Nuvio');
    assert.ok(nuvio?.related?.some((link) => link.href === '/collections/nuvio'));
  });

  it('points Nuvio at the official repo (which only ships pre-releases)', () => {
    const nuvio = items.find((e) => e.title === 'Nuvio');
    assert.equal(entryRepo(nuvio!), 'NuvioMedia/NuvioTV');
  });
});

describe('Collections page groups', () => {
  const sections = childSections(collections);
  const section = (id: string) => sections.find((s) => s.id === id);

  it('splits into Collections and Guides', () => {
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Collections', 'Guides'],
    );
  });

  it('lists Android TV under Collections and Nuvio under Guides', () => {
    assert.deepEqual(
      section('collections')?.pages.map((p) => p.slug),
      ['android-tv'],
    );
    assert.deepEqual(
      section('guides')?.pages.map((p) => p.slug),
      ['nuvio'],
    );
    assert.equal(nuvio.group, 'guides');
  });

  it('links AIOStore straight to its repo, with a copyable manifest URL', () => {
    const entry = section('collections')?.entries.find((e) => e.title === 'AIOStore');
    assert.ok(entry, 'AIOStore card is missing');
    assert.equal(entryRepo(entry), 'zKevinLy/aiostore');

    const url = new URL(entry.commands?.[0]?.command ?? '');
    assert.equal(url.protocol, 'https:');
    assert.ok(url.pathname.endsWith('.json'));
  });

  it('does not give AIOStore a page of its own', () => {
    assert.equal(
      collections.children?.some((c) => c.slug === 'aiostore'),
      false,
    );
  });
});
