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
    intro: 'Hi, I’m Kevin. I build projects, and this is where I keep the stuff I use.',
    paragraphs: [
      'Projects are things I’ve built for specific use cases, or because I found other apps lacking something I wanted.',
      'Resources are public docs and references I use often and want to be able to find quickly.',
      'Collections are bundles of related apps, sources, and tools for one setup.',
    ],
  },

  pages: {
    projects,
    resources,
    collections,
  },
} satisfies SiteConfig;
