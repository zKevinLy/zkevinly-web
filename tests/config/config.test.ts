// Sanity checks on the site content, so a typo in a config file fails CI instead of
// shipping a broken card.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import collections from '../../src/config/collections';
import androidTv from '../../src/config/collections/android-tv';
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
  const nested = (page.children ?? []).flatMap((child) =>
    collectEntries(child, `${where} > ${child.title}`),
  );
  return [...own, ...nested];
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

describe('Android TV page', () => {
  const apps = androidTv.blocks.find((b) => b.type === 'entries');
  const items = apps?.type === 'entries' ? apps.items : [];

  it('lists GitHub-backed apps so version/stars can be shown', () => {
    assert.ok(items.length > 0);
    for (const entry of items)
      assert.ok(entryRepo(entry), `${entry.title} has no resolvable GitHub repo`);
  });

  it('points Nuvio at the official repo (which only ships pre-releases)', () => {
    const nuvio = items.find((e) => e.title === 'Nuvio');
    assert.equal(entryRepo(nuvio!), 'NuvioMedia/NuvioTV');
  });
});
