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
      href: 'https://github.com/zKevinLy/aioplugins',
      tags: ['nuvio', 'plugins', 'provider-manifests', 'resources', 'public', 'github'],
    },
  ],
};

export default projects;
