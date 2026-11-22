import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectPingTargets, entryPing, normalizePingUrl, pageEntries } from '../../src/lib/ping';
import type { DirectoryPage, Entry, TopicPage } from '../../src/config/types';

const entry = (over: Partial<Entry> = {}): Entry => ({
  title: 'App',
  description: 'd',
  href: 'https://app.example.com/',
  ...over,
});

describe('normalizePingUrl', () => {
  it('accepts http(s) URLs and drops the fragment', () => {
    assert.equal(normalizePingUrl('https://a.example.com/x#top'), 'https://a.example.com/x');
    assert.equal(normalizePingUrl('http://nas.local:8096'), 'http://nas.local:8096/');
  });

  it('rejects other schemes, junk and nothing', () => {
    for (const v of ['ftp://a.example.com', 'javascript:alert(1)', 'nope', '', undefined, null]) {
      assert.equal(normalizePingUrl(v), null, String(v));
    }
  });
});

describe('entryPing', () => {
  it('is null unless the entry asks for a ping', () => {
    assert.equal(entryPing(entry()), null);
    assert.equal(entryPing(entry({ ping: false })), null);
  });

  it('`true` checks the entry link through the Worker', () => {
    assert.deepEqual(entryPing(entry({ ping: true })), {
      url: 'https://app.example.com/',
      via: 'worker',
    });
  });

  it('takes its own url and via, and a bare config falls back to href', () => {
    assert.deepEqual(
      entryPing(entry({ ping: { url: 'http://192.168.1.5:8096/health', via: 'browser' } })),
      { url: 'http://192.168.1.5:8096/health', via: 'browser' },
    );
    assert.deepEqual(entryPing(entry({ ping: {} })), {
      url: 'https://app.example.com/',
      via: 'worker',
    });
  });

  it('is null when there is nothing valid to check', () => {
    assert.equal(entryPing(entry({ ping: { url: 'ssh://host' } })), null);
  });
});

describe('collecting entries and targets', () => {
  const direct = entry({ title: 'Direct', ping: true });
  const inBlock = entry({ title: 'Block', ping: { via: 'browser', url: 'http://nas.local/' } });
  const inGroup = entry({ title: 'Group', href: 'https://g.example.com/', ping: true });
  const nested = entry({ title: 'Nested', href: 'https://n.example.com/' });
  const plain = entry({ title: 'Plain', href: 'https://p.example.com/' });

  const directory: DirectoryPage = {
    type: 'directory',
    title: 'D',
    description: 'd',
    items: [direct, plain],
  };
  const topic: TopicPage = {
    type: 'topic',
    slug: 't',
    title: 'T',
    description: 'd',
    groups: [{ id: 'g', title: 'G', entries: [inGroup] }],
    blocks: [
      { type: 'entries', items: [inBlock] },
      { type: 'text', content: 'x' },
    ],
    children: [
      {
        type: 'topic',
        slug: 'c',
        title: 'C',
        description: 'd',
        blocks: [{ type: 'entries', items: [nested] }],
      },
    ],
  };

  it('finds entries in lists, blocks, groups and child pages', () => {
    assert.deepEqual(pageEntries(directory), [direct, plain]);
    assert.deepEqual(
      pageEntries(topic).map((e) => e.title),
      ['Block', 'Group', 'Nested'],
    );
  });

  it('lists each distinct ping once, with who checks it', () => {
    const targets = collectPingTargets([directory, topic, directory]);
    assert.deepEqual(targets.map((t) => `${t.via} ${t.url}`).sort(), [
      'browser http://nas.local/',
      'worker https://app.example.com/',
      'worker https://g.example.com/',
    ]);
  });
});
