import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { site, type SitePage, type TopicPage, type WorkflowNode } from '../../../src/config';
import {
  assertHub,
  descendants,
  findHub,
  getHubLayout,
  getWorkflowBlock,
  nodeTargets,
  stepsFor,
} from '../../../src/lib/topics/hub';
import { layoutWorkflow } from '../../../packages/ui/src/lib/workflow';

const page = (slug: string, over: Partial<TopicPage> = {}): TopicPage => ({
  type: 'topic',
  slug,
  title: slug,
  description: slug,
  blocks: [],
  ...over,
});

const node = (id: string, phase: string, over: Partial<WorkflowNode> = {}): WorkflowNode => ({
  id,
  phase,
  title: id,
  description: id,
  ...over,
});

/** A hub at /h with pages a (a1 beneath it) and b, wired from one start step. */
function makeHub(
  over: { nodes?: WorkflowNode[]; children?: TopicPage[]; workflow?: boolean } = {},
) {
  const nodes = over.nodes ?? [
    node('start', 'p1'),
    node('s1', 'p2', { dependsOn: ['start'], href: '/h/a' }),
    node('s2', 'p2', {
      dependsOn: ['start'],
      href: '/h/b',
      links: [{ label: 'x', href: '/h/a/a1' }],
    }),
  ];
  return page('h', {
    hub: true,
    blocks:
      over.workflow === false
        ? []
        : [
            {
              type: 'workflow',
              title: 'Path',
              phases: [
                { id: 'p1', title: 'One' },
                { id: 'p2', title: 'Two' },
              ],
              nodes,
            } as never,
          ],
    children: over.children ?? [page('a', { children: [page('a1')] }), page('b')],
  });
}

describe('nodeTargets', () => {
  it('lists the site paths a step links to, without query, hash or trailing slash', () => {
    const step = node('s', 'p', {
      href: '/h/a/?x=1#top',
      links: [
        { label: 'ext', href: 'https://example.com/h/a' },
        { label: 'in', href: '/h/b#frag' },
        { label: 'root', href: '/' },
      ],
    });
    assert.deepEqual(nodeTargets(step), ['/h/a', '/h/b', '/']);
  });
  it('is empty for a step that goes nowhere', () => {
    assert.deepEqual(nodeTargets(node('s', 'p')), []);
    assert.deepEqual(nodeTargets(node('s', 'p', { href: 'https://example.com' })), []);
  });
});

describe('descendants', () => {
  it('walks every page beneath, depth first, with its path and depth', () => {
    const refs = descendants(makeHub(), '/h');
    assert.deepEqual(
      refs.map((r) => [r.path, r.depth]),
      [
        ['/h/a', 1],
        ['/h/a/a1', 2],
        ['/h/b', 1],
      ],
    );
  });
  it('is empty for a page with no children', () => {
    assert.deepEqual(descendants(page('x'), '/x'), []);
  });
});

describe('workflow lookup', () => {
  it('finds the workflow block and lays it out', () => {
    const hub = makeHub();
    assert.equal(getWorkflowBlock(hub)?.type, 'workflow');
    assert.equal(getHubLayout(hub)?.nodes.length, 3);
  });
  it('is undefined without a workflow', () => {
    const hub = makeHub({ workflow: false });
    assert.equal(getWorkflowBlock(hub), undefined);
    assert.equal(getHubLayout(hub), undefined);
  });
});

describe('stepsFor', () => {
  const layout = layoutWorkflow(
    makeHub().blocks.length
      ? (makeHub().blocks[0] as never as { nodes: WorkflowNode[] }).nodes
      : [],
    [
      { id: 'p1', title: 'One' },
      { id: 'p2', title: 'Two' },
    ],
  );
  it('returns the steps linking to a page or anything beneath it', () => {
    assert.deepEqual(
      stepsFor(layout, '/h/a')
        .map((n) => n.id)
        .sort(),
      ['s1', 's2'],
    );
    assert.deepEqual(
      stepsFor(layout, '/h/b').map((n) => n.id),
      ['s2'],
    );
    assert.deepEqual(
      stepsFor(layout, '/h/a/a1').map((n) => n.id),
      ['s2'],
    );
  });
  it('does not match look-alike prefixes', () => {
    assert.deepEqual(stepsFor(layout, '/h/ab'), []);
  });
});

describe('findHub', () => {
  const pages = site.pages as Record<string, SitePage>;
  afterEach(() => {
    delete pages.zzhub;
    delete pages.zzplain;
  });

  it('finds the real Nuvio hub from the hub itself and from pages beneath it', () => {
    const atHub = findHub('/collections/nuvio');
    assert.equal(atHub?.hubPath, '/collections/nuvio');
    assert.equal(atHub?.current.path, '/collections/nuvio');
    const deeper = findHub('/collections/nuvio/addons/aiostreams');
    assert.equal(deeper?.hubPath, '/collections/nuvio');
    assert.equal(deeper?.current.path, '/collections/nuvio/addons/aiostreams');
  });

  it('is undefined outside a hub, on unknown paths, and on non-topic pages', () => {
    assert.equal(findHub('/'), undefined);
    assert.equal(findHub('/nowhere'), undefined);
    assert.equal(findHub('/collections'), undefined);
    assert.equal(findHub('/collections/nuvio/not-a-page'), undefined);
    assert.equal(findHub('/projects'), undefined);
  });

  it('a hub at the top level counts, and the closest hub wins', () => {
    const inner = page('inner', { hub: true, children: [page('leaf')] });
    pages.zzhub = page('zzhub', { hub: true, children: [inner] }) as SitePage;
    assert.equal(findHub('/zzhub')?.hubPath, '/zzhub');
    assert.equal(findHub('/zzhub/inner/leaf')?.hubPath, '/zzhub/inner');
    pages.zzplain = page('zzplain', { children: [page('c')] }) as SitePage;
    assert.equal(findHub('/zzplain/c'), undefined);
  });
});

describe('assertHub', () => {
  it('accepts the real Nuvio hub', () => {
    const hub = (site.pages as unknown as Record<string, TopicPage>).collections.children!.find(
      (c) => c.slug === 'nuvio',
    )!;
    assert.doesNotThrow(() => assertHub(hub, '/collections/nuvio'));
  });

  it('accepts a fully connected hub', () => {
    assert.doesNotThrow(() => assertHub(makeHub(), '/h'));
  });

  it('needs a workflow to route through', () => {
    assert.throws(() => assertHub(makeHub({ workflow: false }), '/h'), /needs a workflow block/);
  });

  it('names a step that links to a page that does not exist under the hub', () => {
    const hub = makeHub({
      nodes: [
        node('start', 'p1'),
        node('s1', 'p2', { dependsOn: ['start'], href: '/h/a' }),
        node('s2', 'p2', { dependsOn: ['start'], href: '/h/b' }),
        node('s3', 'p2', { dependsOn: ['start'], href: '/h/ghost' }),
        node('s4', 'p2', { dependsOn: ['start'], href: '/h/a/a1' }),
      ],
    });
    assert.throws(() => assertHub(hub, '/h'), /Step "s3" links to \/h\/ghost/);
  });

  it('names a page that no step reaches', () => {
    const hub = makeHub({
      nodes: [node('start', 'p1'), node('s1', 'p2', { dependsOn: ['start'], href: '/h/a' })],
    });
    assert.throws(() => assertHub(hub, '/h'), /\/h\/b is not linked from any step/);
  });

  it('ignores links that leave the hub', () => {
    const hub = makeHub({
      nodes: [
        node('start', 'p1', { href: '/elsewhere' }),
        node('s1', 'p2', { dependsOn: ['start'], href: '/h/a/a1' }),
        node('s2', 'p2', { dependsOn: ['start'], href: '/h/b' }),
      ],
    });
    assert.doesNotThrow(() => assertHub(hub, '/h'));
  });
});
