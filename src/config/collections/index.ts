import type { TopicPage } from '../types';
import nuvio from './nuvio';
import androidTv from './android-tv';

const collections: TopicPage = {
  type: 'topic',
  slug: 'collections',
  title: 'Collections',
  description:
    'My hand-picked favorites, plus the step-by-step guides I wrote for setting them up.',
  showInNav: true,
  tags: ['collections', 'favorites', 'guides'],

  introduction:
    'Unlike Resources, which is a broad reference list, everything here is something I’ve personally chosen as one of the best in its category, or simply a favorite to use. Collections are the picks themselves; Guides are my own walkthroughs for getting them working.',

  blocks: [
    {
      type: 'text',
      title: 'About Collections',
      content:
        'Each entry is a pick I stand behind. If it’s here, it’s because I’ve tried the alternatives and this is the one I keep coming back to.',
    },
  ],

  groups: [
    {
      id: 'collections',
      title: 'Collections',
      description: 'Hand-picked lists of the apps and sources I actually use.',
      entries: [
        {
          title: 'AIO Store',
          description:
            'A master list of Store and SideStore sources. Copy the manifest URL to get every source in one place.',
          href: 'https://github.com/zKevinLy/aiostore',
          tags: ['store', 'sidestore', 'sideloading', 'ios', 'sources', 'github'],
          commands: [
            {
              label: 'Manifest URL',
              command:
                'https://raw.githubusercontent.com/zKevinLy/aiostore/refs/heads/main/store.json',
            },
          ],
        },
      ],
    },
    {
      id: 'guides',
      title: 'Guides',
      description: 'Step-by-step setup walkthroughs, written by me.',
    },
  ],

  children: [androidTv, nuvio],
};

export default collections;
