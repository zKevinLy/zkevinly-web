
export interface Entry {
  title: string;
  description: string;
  href: string;
  tags?: string[];
  status?: 'live' | 'wip' | 'archived';
}

interface BasePage {
  title: string;
  description: string;
  showInNav?: boolean;
}

export interface DirectoryPage extends BasePage {
  type: 'directory';
  items: Entry[];
}

export interface TopicLink {
  title: string;
  description: string;
  href: string;
  label?: string;
}

export type TopicBlock =
  | {
      type: 'text';
      title?: string;
      content: string;
    }
  | {
      type: 'links';
      title: string;
      description?: string;
      items: TopicLink[];
    }
  | {
      type: 'steps';
      title: string;
      items: string[];
    }
  | {
      type: 'image';
      title?: string;
      src: string;
      alt: string;
      caption?: string;
    };

export interface TopicPage extends BasePage {
  type: 'topic';
  slug: string;
  introduction?: string;
  blocks: TopicBlock[];
  children?: TopicPage[];
}

export type SitePage = DirectoryPage | TopicPage;

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

  pages: {
    projects: {
      type: 'directory',
      title: 'Projects',
      description: 'Software and things I’ve built.',
      showInNav: true,
      items: [
        {
          title: 'AIOPlugins',
          description: 'Public Nuvio-related resources.',
          href: 'https://github.com/zKevinLy/aioplugins',
          tags: ['nuvio', 'plugins'],
          status: 'live',
        },
      ],
    },

    resources: {
      type: 'directory',
      title: 'Resources',
      description: 'Public resources and documentation.',
      showInNav: true,
      items: [
        {
          title: 'FMHY (Free Media Heck Yeah)',
          description:
            'A community-maintained directory of free websites, tools, software, streaming, books, and digital resources.',
          href: 'https://github.com/fmhy/FMHY',
          tags: ['resources', 'free-media', 'directory', 'github'],
        },
      ],
    },

    tools: {
      type: 'directory',
      title: 'Tools',
      description: 'Useful utilities and web applications.',
      showInNav: true,
      items: [
        {
          title: 'Example tool',
          description: 'A small web utility.',
          href: '/tools',
          status: 'wip',
        },
      ],
    },

    links: {
      type: 'directory',
      title: 'Links',
      description: 'Interesting corners of the internet.',
      showInNav: true,
      items: [
        {
          title: 'Massgrave',
          description:
            'Windows activation scripts, installation resources, and licensing guides.',
          href: 'https://github.com/massgravel/Microsoft-Activation-Scripts',
          tags: ['windows', 'activation', 'github'],
        },
        {
          title: 'Chris Titus Tech WinUtil',
          description:
            'Windows utility for system tweaks, debloating, updates, and software installation.',
          href: 'https://github.com/ChrisTitusTech/winutil',
          tags: ['windows', 'utility', 'github'],
        },
      ],
    },

    nuvio: {
      type: 'topic',
      slug: 'nuvio',
      title: 'Nuvio',
      description: 'Nuvio resources, configuration, and setup guides.',
      showInNav: true,
      introduction:
        'A central collection of Nuvio-related resources, addon configurations, metadata providers, and integrations.',

      blocks: [
        {
          type: 'text',
          title: 'About Nuvio',
          content:
            'A collection of useful resources and configuration links for managing your Nuvio setup.',
        },
        {
          type: 'links',
          title: 'Main Resources',
          description: 'Essential websites and services.',
          items: [
            {
              title: 'Nuvio',
              description: 'Official Nuvio website.',
              href: 'https://nuvio.tv/',
              label: 'Official',
            },
            {
              title: 'PENGU',
              description: 'Related community resources.',
              href: 'https://pengu.uk/',
            },
            {
              title: 'Trakt',
              description: 'Watch history and list integrations.',
              href: 'https://app.trakt.tv/home',
            },
          ],
        },
      ],

      children: [
        {
          type: 'topic',
          slug: 'getting-started',
          title: 'Getting Started',
          description: 'Learn how to set up and configure Nuvio.',
          blocks: [
            {
              type: 'steps',
              title: 'Setup Guide',
              items: [
                'Visit the Nuvio website and set up your account.',
                'Configure AIOStreams to add addons and filters.',
                'Obtain API credentials from TMDB and TheTVDB.',
                'Configure AIOMetadata with the obtained API credentials for catalogs.',
                'Copy the manifests from AIOStreams and AIOMetadata into your Nuvio addon configuration.',
                'Copy the Plugin Provider Manifest.json files into your Nuvio plugin configuration.',
                'Connect Trakt if you want watch-history synchronization.',
              ],
            },
          ],
        },

        {
          type: 'topic',
          slug: 'addons',
          title: 'Addons',
          description: 'Addon configuration and resources.',
          blocks: [
            {
              type: 'text',
              title: 'About Addons',
              content:
                'Explore addon configuration tools and integrations to extend your Nuvio setup.',
            },
          ],
          children: [
            {
              type: 'topic',
              slug: 'aiostreams',
              title: 'AIOStreams',
              description: 'Stream provider configuration and addon settings.',
              blocks: [
                {
                  type: 'text',
                  title: 'About AIOStreams',
                  content:
                    'Configure stream providers, filters, and addon settings for your setup.',
                },
                {
                  type: 'links',
                  title: 'Configuration',
                  items: [
                    {
                      title: 'AIOStreams Configuration',
                      description:
                        'Configure stream providers and addon settings.',
                      href: 'https://aiostreamsfortheweebsstable.midnightignite.me/stremio/configure',
                    },
                  ],
                },
              ],
            },

            {
              type: 'topic',
              slug: 'aiometadata',
              title: 'AIOMetadata',
              description: 'Metadata providers and catalog configuration.',
              blocks: [
                {
                  type: 'text',
                  title: 'About AIOMetadata',
                  content:
                    'Configure metadata providers and catalogs for your Nuvio setup.',
                },
                {
                  type: 'links',
                  title: 'Configuration',
                  items: [
                    {
                      title: 'AIOMetadata Configuration',
                      description:
                        'Configure metadata providers and catalogs.',
                      href: 'https://aiometadatafortheweebs.midnightignite.me/configure/',
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
          blocks: [
            {
              type: 'text',
              title: 'About API Providers',
              content:
                'Manage API credentials used by metadata providers and integrations.',
            },
            {
              type: 'links',
              title: 'API Resources',
              items: [
                {
                  title: 'TMDB',
                  description: 'Manage API credentials.',
                  href: 'https://www.themoviedb.org/settings/api',
                },
                {
                  title: 'TheTVDB',
                  description: 'API information and developer access.',
                  href: 'https://thetvdb.com/api-information',
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
          blocks: [
            {
              type: 'text',
              title: 'About Provider Manifests',
              content:
                'Community-maintained manifests that provide additional integrations and providers for Nuvio.',
            },
            {
              type: 'links',
              title: 'Available Manifests',
              items: [
                {
                  title: 'Nuvio Providers',
                  description: 'Yoruix community provider manifest.',
                  href: 'https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json',
                },
                {
                  title: 'All-in-One Nuvio',
                  description: 'D3adlyRocket community provider manifest.',
                  href: 'https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json',
                },
              ],
            },
          ],
        },
      ],
    },
  } as Record<string, SitePage>,
};