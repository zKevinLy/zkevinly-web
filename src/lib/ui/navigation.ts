// This site's navigation, derived from its config. (Path helpers like isActivePath live in the
// UI package: @zkevinly/ui/lib/navigation.)

import { site, type SitePage, type TopicPage } from '../../config';
import { toolkit } from '../../config/toolkit';

export interface Crumb {
  title: string;
  href: string;
}

/** Top-level pages flagged `showInNav`, in config order, then the Toolkit section. */
export function getNavItems(): { href: string; label: string }[] {
  const pages = Object.entries(site.pages as Record<string, SitePage>)
    .filter(([, page]) => page.showInNav === true)
    .map(([slug, page]) => ({ href: `/${slug}`, label: page.title }));

  return [...pages, { href: toolkit.path, label: toolkit.title }];
}

/** Walks the page tree to build breadcrumbs for a URL like /collections/nuvio/addons. */
export function getBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const pages = site.pages as Record<string, SitePage>;
  const crumbs: Crumb[] = [];

  let current: SitePage | undefined = pages[segments[0]];
  if (!current) return crumbs;

  crumbs.push({ title: current.title, href: `/${segments[0]}` });

  for (const segment of segments.slice(1)) {
    if (current?.type !== 'topic') break;

    const child: TopicPage | undefined = current.children?.find((item) => item.slug === segment);
    if (!child) break;

    current = child;
    crumbs.push({
      title: child.title,
      href: `/${segments.slice(0, crumbs.length + 1).join('/')}`,
    });
  }

  return crumbs;
}
