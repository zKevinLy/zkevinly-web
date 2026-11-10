import type { DirectoryPage } from '../types';

const projects: DirectoryPage = {
  type: 'directory',
  title: 'Projects',
  description: 'Software and things I’ve built.',
  showInNav: true,
  alwaysFilter: true,

  items: [
    {
      title: 'AIOPlugins',
      description: 'Public Nuvio-related resources.',
      // The repo is private, so the card goes to the website. `repo` is set explicitly
      // because it can no longer be inferred from `href`; release/commit info only shows
      // when the build has a GITHUB_TOKEN that can read the private repo.
      href: 'https://aioplugins.zkevinly.com/',
      repo: 'zKevinLy/aioplugins',
      tags: ['nuvio', 'plugins', 'provider-manifests', 'resources', 'public', 'website'],
    },
    {
      title: 'Perkday',
      description: 'A personal project for finding and tracking everyday perks.',
      href: 'https://perkday.zkevinly.com/',
      repo: 'zKevinLy/perkday',
      tags: ['perks', 'personal', 'astro', 'cloudflare', 'website'],
    },
  ],
};

export default projects;
