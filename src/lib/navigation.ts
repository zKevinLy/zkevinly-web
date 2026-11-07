// Navigation helpers shared by the build (Header, Topics layout) and the
// browser (Header's active-link script). Keep this file free of Node-only APIs.

import { site, type SitePage, type TopicPage } from '../config';

export interface Crumb {
  title: string;
  href: string;
}

/** Top-level pages flagged `showInNav`, in config order. */
export function getNavItems(): { href: string; label: string }[] {
  return Object.entries(site.pages as Record<string, SitePage>)
    .filter(([, page]) => page.showInNav === true)
    .map(([slug, page]) => ({ href: `/${slug}`, label: page.title }));
}

/** "/projects/" -> "/projects", "" -> "/". */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

/** True when `pathname` is `href` or anywhere below it. */
export function isActivePath(pathname: string, href: string): boolean {
  const path = normalizePath(pathname);
  return path === href || path.startsWith(href + '/');
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
