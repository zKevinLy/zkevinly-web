import type { TopicPage } from '../types';
import nuvio from './nuvio';

const collections: TopicPage = {
  type: 'topic',
  slug: 'collections',
  title: 'Collections',
  description: 'My hand-picked favorites: the best things I’ve found and actually use.',
  showInNav: true,

  introduction:
    'Unlike Resources, which is a broad reference list, everything here is something I’ve personally chosen as one of the best in its category, or simply a favorite to use.',

  blocks: [
    {
      type: 'text',
      title: 'About Collections',
      content:
        'Each entry is a pick I stand behind. If it’s here, it’s because I’ve tried the alternatives and this is the one I keep coming back to.',
    },
  ],

  children: [nuvio],
};

export default collections;
