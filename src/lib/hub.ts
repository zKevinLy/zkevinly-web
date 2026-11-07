// Hub pages: a topic page flagged `hub: true` is the single way into everything
// beneath it. These helpers resolve hub context for a URL, find which workflow
// steps reference a page, and fail the build if any page would float free.

import {
  site,
  type SitePage,
  type TopicBlock,
  type TopicPage,
  type WorkflowBlock,
  type WorkflowNode,
} from '../config';
import { layoutWorkflow, type LaidOutNode, type WorkflowLayout } from './workflow';

export interface PageRef {
  page: TopicPage;
  path: string;
  depth: number;
}

export interface HubContext {
  hub: TopicPage;
  hubPath: string;
  current: { page: TopicPage; path: string };
}

const clean = (href: string): string => href.replace(/[?#].*$/, '').replace(/\/$/, '') || '/';

/** Internal (site) paths a step links to, normalised. */
export function nodeTargets(node: WorkflowNode): string[] {
  return [node.href, ...(node.links ?? []).map((link) => link.href)]
    .filter((href): href is string => typeof href === 'string' && href.startsWith('/'))
    .map(clean);
}

/** Every page beneath `page`, depth-first. */
export function descendants(page: TopicPage, path: string, depth = 1): PageRef[] {
  return (page.children ?? []).flatMap((child): PageRef[] => {
    const childPath = `${path}/${child.slug}`;
    return [{ page: child, path: childPath, depth }, ...descendants(child, childPath, depth + 1)];
  });
}

export function getWorkflowBlock(page: TopicPage): WorkflowBlock | undefined {
  return page.blocks.find((block: TopicBlock): block is WorkflowBlock => block.type === 'workflow');
}

export function getHubLayout(hub: TopicPage): WorkflowLayout | undefined {
  const block = getWorkflowBlock(hub);
  return block ? layoutWorkflow(block.nodes, block.phases) : undefined;
}

/** Steps that link to `path`, or to any page beneath it. */
export function stepsFor(layout: WorkflowLayout, path: string): LaidOutNode[] {
  return layout.nodes.filter((node) =>
    nodeTargets(node).some((target) => target === path || target.startsWith(`${path}/`)),
  );
}

/** The closest hub at or above `pathname`, if any. */
export function findHub(pathname: string): HubContext | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const first = (site.pages as Record<string, SitePage>)[segments[0]];
  if (!first || first.type !== 'topic') return undefined;

  let page: TopicPage = first;
  let path = `/${segments[0]}`;
  let hub = page.hub ? { page, path } : undefined;

  for (const segment of segments.slice(1)) {
    const child = page.children?.find((item) => item.slug === segment);
    if (!child) return undefined;
    page = child;
    path = `${path}/${segment}`;
    if (page.hub) hub = { page, path };
  }

  return hub ? { hub: hub.page, hubPath: hub.path, current: { page, path } } : undefined;
}

/** Fails the build if the hub's workflow is invalid or any page beneath it is unreachable. */
export function assertHub(hub: TopicPage, hubPath: string): void {
  const layout = getHubLayout(hub);
  if (!layout) {
    throw new Error(`Hub ${hubPath} needs a workflow block to route its pages through.`);
  }

  const pages = descendants(hub, hubPath);
  const known = new Set(pages.map((ref) => ref.path));
  const problems: string[] = [];

  for (const node of layout.nodes) {
    for (const target of nodeTargets(node)) {
      if (target.startsWith(`${hubPath}/`) && !known.has(target)) {
        problems.push(`Step "${node.id}" links to ${target}, which is not a page under the hub.`);
      }
    }
  }

  for (const ref of pages) {
    if (stepsFor(layout, ref.path).length === 0) {
      problems.push(`${ref.path} is not linked from any step, so it would float free of the path.`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Hub ${hubPath} is not fully connected:\n - ${problems.join('\n - ')}`);
  }
}
