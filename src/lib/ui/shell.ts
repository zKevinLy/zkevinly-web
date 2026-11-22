// What this site feeds the UI package's page shell (header, title, nav). Shared by both layouts.

import { site } from '../../config';
import { getNavItems } from './navigation';

// Set at build time by CI (PUBLIC_APP_VERSION); local dev shows "dev".
const version =
  (import.meta.env.PUBLIC_APP_VERSION as string | undefined) ||
  (import.meta.env.DEV ? 'dev' : undefined);

export function shellProps() {
  return {
    name: site.name,
    nav: getNavItems(),
    version,
    aboutHref: '/about',
    githubUrl: site.github,
    searchPlaceholder: 'Search projects, resources, tools...',
    description: site.tagline,
  };
}
