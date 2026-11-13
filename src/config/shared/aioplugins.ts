import type { Entry } from '../types';

/**
 * The AIOPlugins card, defined once. It's listed on Projects and on Nuvio > Provider
 * Manifests; both import this object, so editing it here updates every place it shows.
 */
const aioPlugins: Entry = {
  title: 'AIOPlugins',
  description: 'Public Nuvio-related resources.',
  // The repo is private, so the card goes to the website. `repo` is set explicitly
  // because it can no longer be inferred from `href`; release/commit info only shows
  // when the build has a GITHUB_TOKEN that can read the private repo.
  href: 'https://aioplugins.zkevinly.com/',
  repo: 'zKevinLy/aioplugins',
  repoPrivate: true,
  tags: ['nuvio', 'plugins', 'provider-manifests', 'resources', 'public', 'website'],
};

export default aioPlugins;
