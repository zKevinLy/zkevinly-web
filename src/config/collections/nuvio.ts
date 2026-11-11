import type { TopicPage } from '../types';

const NUVIO_HUB = '/collections/nuvio';

const nuvio: TopicPage = {
  type: 'topic',
  slug: 'nuvio',
  group: 'guides',
  hub: true,

  title: 'Nuvio',
  description: 'My pick for the best media app, with configuration and setup guides.',
  tags: [
    'media-app',
    'setup-guide',
    'stremio-addons',
    'aiostreams',
    'aiometadata',
    'trakt',
    'android-tv',
  ],

  introduction:
    'A solid base setup: get your API keys, set up AIOStreams as the single hub for your streams and AIOMetadata for your catalogs, add both on nuvio.tv, then refresh the app. This guide is built around HTTPS addons; debrid is easy to add later through AIOStreams. This page is the hub for everything Nuvio: each step links to the pages it needs, and every one of those pages links back to the steps that use it. Hover or focus a step to trace what it requires and what it unlocks.',

  blocks: [
    {
      type: 'workflow',
      title: 'Recommended setup path',
      description:
        'Read it top to bottom. Steps side by side are independent of each other, so do them in either order. Everything above Extras is required.',

      phases: [
        {
          id: 'install',
          title: 'Install',
          description: 'One app, one account, one profile.',
        },
        {
          id: 'prepare',
          title: 'Prepare',
          description: 'Your API keys and your stream hub don’t depend on each other.',
        },
        {
          id: 'metadata',
          title: 'Metadata',
          description: 'AIOMetadata needs your TMDB and TVDB keys.',
        },
        {
          id: 'connect',
          title: 'Connect',
          description: 'Add both addons to your account on the Nuvio website.',
        },
        {
          id: 'verify',
          title: 'Verify',
          description: 'Refresh the app and confirm everything works.',
        },
        {
          id: 'extras',
          title: 'Extras',
          description: 'Each branches off once the core works.',
        },
      ],

      nodes: [
        {
          id: 'account',
          phase: 'install',
          title: 'Install Nuvio and create an account',
          description:
            'Install the app for your device, create your Nuvio account, and sign in on both the app and the website. You’ll do most of the configuration on the website.',
          href: 'https://nuvio.tv/',
          links: [
            {
              label: 'Android TV app',
              href: '/collections/android-tv',
            },
          ],
          tags: ['nuvio', 'account', 'install', 'android-tv'],
        },
        {
          id: 'api',
          phase: 'prepare',
          title: 'Get your TMDB and TVDB API keys',
          description:
            'AIOMetadata requires both a TMDB and a TheTVDB API key. Create them now and keep them handy for the next steps.',
          href: `${NUVIO_HUB}/api-providers`,
          dependsOn: ['account'],
          tags: ['api-keys', 'tmdb', 'tvdb', 'metadata'],
        },
        {
          id: 'streams',
          phase: 'prepare',
          title: 'Set up AIOStreams as your stream hub',
          description:
            'AIOStreams is the one place every stream addon goes through, so its formatting, sorting, and filtering apply to all of your sources. Configure it, add your HTTPS addons inside it (such as PenguPlay), and copy its manifest URL when you’re done.',
          href: `${NUVIO_HUB}/addons/aiostreams`,
          links: [
            {
              label: 'Addon overview',
              href: `${NUVIO_HUB}/addons`,
            },
            {
              label: 'HTTPS addon · PenguPlay',
              href: 'https://pengu.uk/',
            },
            {
              label: 'More HTTPS addons · Megathread',
              href: 'https://www.reddit.com/r/nuvioaddons/s/2vecDkz7wb',
            },
          ],
          dependsOn: ['account'],
          tags: ['aiostreams', 'streams', 'https-addons', 'manifest-url'],
        },
        {
          id: 'catalog',
          phase: 'metadata',
          title: 'Set up AIOMetadata for your catalogs',
          description:
            'AIOMetadata lets you build custom catalogs and organize how your library is laid out. Enter the TMDB and TVDB keys from the previous step, configure it, and copy its manifest URL when you’re done. If your AIOStreams configuration already includes AIOMetadata, don’t install a duplicate.',
          href: `${NUVIO_HUB}/addons/aiometadata`,
          dependsOn: ['api'],
          tags: ['aiometadata', 'catalogs', 'metadata', 'manifest-url'],
        },
        {
          id: 'connect',
          phase: 'connect',
          title: 'Add both addons on nuvio.tv',
          description:
            'Sign in at nuvio.tv and add each manifest URL there: AIOMetadata first, then AIOStreams, so metadata stays above streams. The website is much faster than the in-app menus, so skip the app for this.',
          href: 'https://nuvio.tv/',
          dependsOn: ['catalog', 'streams'],
          tags: ['nuvio-website', 'addons', 'manifest-url'],
        },
        {
          id: 'verify',
          phase: 'verify',
          title: 'Refresh the app and verify',
          description:
            'Open Nuvio and manually refresh so it picks up your addons. This is the only step that needs the in-app UI. Then open a movie and an episode, confirm your catalogs and metadata load, and test playback.',
          dependsOn: ['connect'],
          tags: ['nuvio-app', 'refresh', 'playback', 'testing'],
        },
        {
          id: 'trakt',
          phase: 'extras',
          title: 'Connect Trakt',
          description:
            'Optional, but highly recommended: Trakt handles watch history, lists, and progress sync across devices better than Nuvio’s built-in option.',
          href: 'https://app.trakt.tv/home',
          dependsOn: ['verify'],
          optional: true,
          branch: 'Highly recommended',
          tags: ['trakt', 'watch-history', 'lists', 'sync'],
        },
        {
          id: 'plugins',
          phase: 'extras',
          title: 'Install optional provider plugins',
          description:
            'If you want extra device-side providers, install a plugin repository manifest in Nuvio’s Plugins area. This is separate from Stremio-compatible Addons and may require the sideloaded app build.',
          href: `${NUVIO_HUB}/provider-manifests`,
          dependsOn: ['verify'],
          optional: true,
          tags: ['plugins', 'provider-manifests', 'sideload'],
        },
      ],
    },
    {
      type: 'index',
      title: 'Everything in this guide',
      description: 'Every page under Nuvio, grouped, with the setup steps that use it.',
    },
  ],

  children: [
    {
      type: 'topic',
      slug: 'addons',
      title: 'Addons',
      description: 'Addon configuration and resources.',
      tags: ['addons', 'stremio-addons', 'aiostreams', 'aiometadata'],

      blocks: [
        {
          type: 'text',
          title: 'About Addons',
          content: 'Explore addon configuration tools and integrations to extend your Nuvio setup.',
        },
      ],

      children: [
        {
          type: 'topic',
          slug: 'aiostreams',
          title: 'AIOStreams',
          description: 'Stream provider configuration and addon settings.',
          tags: ['aiostreams', 'streams', 'configuration', 'https-addons'],

          introduction:
            'AIOStreams is the central point every stream addon goes through. Add your HTTPS addons inside it and use its formatting, sorting, and filtering across all of them, then install it in Nuvio as your single stream addon.',

          blocks: [
            {
              type: 'text',
              title: 'About AIOStreams',
              content:
                'Add your HTTPS addons, then configure formatting, sorting, and filtering so every source is presented the way you want.',
            },
            {
              type: 'links',
              title: 'Configuration',
              items: [
                {
                  title: 'AIOStreams Configuration',
                  description: 'Configure stream providers and addon settings.',
                  href: 'https://aiostreams.elfhosted.com/stremio/configure',
                  tags: ['aiostreams', 'configurator', 'stremio-addon', 'streams'],
                },
                {
                  title: 'AIOStreams in Nuvio',
                  description:
                    'Current guide for configuring AIOStreams and installing its manifest.',
                  href: 'https://docs.elfhosted.com/nuvio/aiostreams-nuvio/',
                  label: 'Guide',
                  tags: ['aiostreams', 'guide', 'documentation', 'elfhosted'],
                },
                {
                  title: 'AIOStreams configuration walkthrough',
                  description:
                    'Community guide with ready-made configurations and stream-list explanations.',
                  href: 'https://www.reddit.com/r/nuvioaddons/comments/1xlg3c0/complete_tutorial_with_configs_for_aiostreams/',
                  label: 'Reddit',
                  tags: ['aiostreams', 'guide', 'community', 'reddit', 'configs'],
                },
              ],
            },
          ],
        },
        {
          type: 'topic',
          slug: 'aiometadata',
          title: 'AIOMetadata',
          description: 'Custom catalogs and metadata configuration.',
          tags: ['aiometadata', 'catalogs', 'metadata', 'configuration', 'tmdb', 'tvdb'],

          introduction:
            'AIOMetadata lets you build custom catalogs and organize how your library is laid out. It requires your TMDB and TVDB API keys, and should sit above AIOStreams so its metadata is prioritized.',

          blocks: [
            {
              type: 'text',
              title: 'About AIOMetadata',
              content: 'Build custom catalogs and configure metadata for your Nuvio setup.',
            },
            {
              type: 'links',
              title: 'Configuration',
              items: [
                {
                  title: 'AIOMetadata Configuration',
                  description: 'Configure metadata providers and catalogs.',
                  href: 'https://aiometadatafortheweebs.midnightignite.me/configure/',
                  tags: ['aiometadata', 'configurator', 'catalogs', 'metadata'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'topic',
      slug: 'api-providers',
      title: 'API Providers',
      description: 'API credentials and provider information.',
      tags: ['api-keys', 'tmdb', 'tvdb', 'metadata'],

      blocks: [
        {
          type: 'text',
          title: 'About API Providers',
          content:
            'AIOMetadata requires both a TMDB and a TheTVDB API key. Create them here before configuring it.',
        },
        {
          type: 'links',
          title: 'API Resources',
          items: [
            {
              title: 'TMDB',
              description: 'Manage API credentials.',
              href: 'https://www.themoviedb.org/settings/api',
              tags: ['api-keys', 'metadata', 'movies', 'tv-shows', 'required'],
            },
            {
              title: 'TheTVDB',
              description: 'API information and developer access.',
              href: 'https://thetvdb.com/api-information',
              tags: ['api-keys', 'metadata', 'tv-shows', 'required'],
            },
          ],
        },
      ],
    },
    {
      type: 'topic',
      slug: 'provider-manifests',
      title: 'Provider Manifests',
      description: 'Community provider manifests for Nuvio.',
      tags: ['plugins', 'provider-manifests', 'community', 'sideload'],

      blocks: [
        {
          type: 'text',
          title: 'About Provider Manifests',
          content:
            'Community-maintained manifests that provide additional integrations and providers for Nuvio. These are installed in Nuvio’s Plugins manager, not the Addons manager; plugin support may depend on using a sideloaded app build.',
        },
        {
          type: 'links',
          title: 'Available Manifests',
          items: [
            {
              title: 'Nuvio Providers',
              description: 'Yoruix community provider manifest.',
              href: 'https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json',
              tags: ['plugins', 'provider-manifest', 'community', 'yoruix'],
            },
            {
              title: 'All-in-One Nuvio',
              description: 'D3adlyRocket community provider manifest.',
              href: 'https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json',
              tags: ['plugins', 'provider-manifest', 'community', 'd3adlyrocket'],
            },
          ],
        },
      ],
    },
  ],
};

export default nuvio;
