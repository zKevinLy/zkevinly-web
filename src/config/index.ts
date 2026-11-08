import type { SiteConfig } from './types';
export type * from './types';

import projects from './projects';
import resources from './resources';
import collections from './collections';

export const site = {
  name: 'zkevinly',
  domain: 'zkevinly.com',
  url: 'https://zkevinly.com',
  tagline: 'Things I build, collect, and find interesting.',

  home: {
    description:
      'A central place for the things I build, publish, collect, and explore. Each project can live on its own; this is the front door.',
  },

  github: 'https://github.com/zKevinLy',

  about: {
    title: 'About',
    description: 'A little about me and this site.',
    intro: 'Hi, I’m Kevin. I build a few things, and I keep track of a lot of other people’s work.',
    paragraphs: [
      'This site is my front door and my bookmark shelf in one. Projects is the only section that’s my own work; each one lives in its own repo and gets linked from here.',
      'Resources and Collections are different: most of what’s listed there was made by other people, not me. I keep it here so everything I use is in one place, with the latest release, star count, and last-updated date on each card, so I can see at a glance what’s changed.',
      'The setup guides, like the Nuvio path, are my own write-ups, but the apps, addons, and tools they point to belong to their creators. All credit for those goes to them.',
    ],
  },

  pages: {
    projects,
    resources,
    collections,
  },
} satisfies SiteConfig;
