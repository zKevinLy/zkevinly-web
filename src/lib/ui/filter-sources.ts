// Maps this site's content (entries, topic pages) to what the UI package's filter understands.

import type { FilterSource } from '@zkevinly/ui/lib/filter';
import type { Entry, TopicPage } from '../../config/types';
import { entryRepo } from '../github';

export function entrySource(entry: Entry): FilterSource {
  return {
    title: entry.title,
    description: entry.description,
    tags: entry.tags,
    repo: entryRepo(entry),
    updated: entry.updated,
  };
}

/**
 * Everything on a topic page that FilterBar can filter. Hubs are excluded: their
 * workflow is an ordered path, not a list.
 */
export function pageSources(page: TopicPage): FilterSource[] {
  if (page.hub) return [];

  const children = (page.children ?? []).map((child) => ({
    title: child.title,
    description: child.description,
    tags: child.tags,
  }));

  const fromBlocks = page.blocks.flatMap((block): FilterSource[] => {
    if (block.type === 'links') {
      return block.items.map((l) => ({
        title: l.title,
        description: l.description,
        label: l.label,
        tags: l.tags,
      }));
    }
    if (block.type === 'entries') return block.items.map(entrySource);
    return [];
  });

  const fromGroups = (page.groups ?? []).flatMap((group) => (group.entries ?? []).map(entrySource));

  return [...children, ...fromGroups, ...fromBlocks];
}
