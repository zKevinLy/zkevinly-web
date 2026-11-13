import type { DirectoryPage } from '../types';
import aioPlugins from '../shared/aioplugins';

const projects: DirectoryPage = {
  type: 'directory',
  title: 'Projects',
  description: 'Software and things I’ve built.',
  showInNav: true,
  alwaysFilter: true,

  items: [
    aioPlugins,
    {
      title: 'Perkday',
      description: 'A personal project for finding and tracking everyday perks.',
      href: 'https://perkday.zkevinly.com/',
      repo: 'zKevinLy/perkday',
      repoPrivate: true,
      tags: ['perks', 'personal', 'astro', 'cloudflare', 'website'],
    },
  ],
};

export default projects;
