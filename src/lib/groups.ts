// Splits a topic page's child pages into the titled sections they're listed under.
// Shared by the Topics layout and the content tests. Keep this file free of Node-only APIs.

import type { Entry, TopicPage } from '../config/types';

export interface ChildSection {
  id: string;
  title: string;
  note?: string;
  pages: TopicPage[];
  /** Entry cards that belong to the section, shown after its pages. */
  entries: Entry[];
}

/**
 * One section per entry in `page.groups` (in that order, skipping empty ones), or a
 * single "Explore …" section when the page has no groups. Throws when a child names a
 * group that doesn't exist, or has none while its parent defines groups, so a typo
 * fails the build instead of making a page disappear.
 */
export function childSections(page: TopicPage): ChildSection[] {
  const children = page.children ?? [];

  if (!page.groups?.length) {
    return children.length > 0
      ? [{ id: 'all', title: `Explore ${page.title}`, pages: children, entries: [] }]
      : [];
  }

  const known = new Set(page.groups.map((group) => group.id));
  const stray = children.filter((child) => !child.group || !known.has(child.group));
  if (stray.length > 0) {
    const list = stray.map((child) => `"${child.title}" (group: ${child.group ?? 'none'})`);
    throw new Error(
      `"${page.title}" has groups (${[...known].join(', ')}), but these pages aren't in one: ${list.join(', ')}.`,
    );
  }

  return page.groups
    .map((group) => ({
      id: group.id,
      title: group.title,
      note: group.description,
      pages: children.filter((child) => child.group === group.id),
      entries: group.entries ?? [],
    }))
    .filter((section) => section.pages.length > 0 || section.entries.length > 0);
}
