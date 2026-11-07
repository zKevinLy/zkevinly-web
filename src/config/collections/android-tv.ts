import type { TopicPage } from '../types';

const androidTv: TopicPage = {
  type: 'topic',
  slug: 'android-tv',

  title: 'Android TV',
  description: 'GitHub repos for the Android TV apps I use.',

  introduction:
    'The Android TV apps I actually keep installed. Each card shows the latest GitHub release, star count, and when the repo was last updated, so you can tell at a glance what’s still maintained. Use the filter to narrow by tag or sort by recent activity.',

  blocks: [
    {
      type: 'entries',
      title: 'Apps',
      items: [
        {
          title: 'TV Bro',
          description:
            'Web browser built for TV remotes, with tabs, bookmarks, voice search, and a built-in download manager.',
          href: 'https://github.com/truefedex/tv-bro',
          tags: ['android-tv', 'browser', 'github'],
        },
        {
          title: 'Projectivy Launcher',
          description:
            'Customizable, ad-free Android TV launcher with wallpapers, icon packs, and plugins. This repo hosts the APKs and the issue tracker.',
          href: 'https://github.com/spocky/miproja1',
          tags: ['android-tv', 'launcher', 'github'],
        },
        {
          title: 'Nuvio',
          description: 'Official Nuvio Android TV app, powered by the Stremio addon ecosystem.',
          href: 'https://github.com/NuvioMedia/NuvioTV',
          tags: ['android-tv', 'media', 'github'],
        },
        {
          title: 'SmartTube',
          description: 'Ad-free YouTube client for Android TV.',
          href: 'https://github.com/yuliskov/SmartTube',
          tags: ['android-tv', 'youtube', 'github'],
        },
      ],
    },
  ],
};

export default androidTv;
