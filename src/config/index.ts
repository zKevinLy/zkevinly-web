import type { SiteConfig } from './types';

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
    intro: 'Hi, I’m Kevin. I build software and collect things worth sharing.',
    paragraphs: [
      'This site is my front door: a place for the projects I build, the resources I rely on, and the corners of the internet I find interesting.',
      'Everything here is a work in progress. Projects live in their own repos; this is where they all get linked together.',
    ],
  },

  pages: {
    projects,
    resources,
    collections,
  },
} satisfies SiteConfig;
