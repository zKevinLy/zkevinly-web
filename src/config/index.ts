export interface CopyCommand {
  label?: string;
  command: string;
}

export interface Entry {
  title: string;
  description: string;
  href: string;
  tags?: string[];
  /**
   * GitHub repo ("owner/name") used for the version badge, stars and
   * "last updated". Inferred automatically from `href` when it points at
   * github.com; set to `false` to opt out.
   */
  repo?: string | false;
  /** Click-to-copy commands shown on the card. */
  commands?: CopyCommand[];
  /** Manual "last updated" (ISO date) for entries that aren't on GitHub. */
  updated?: string;
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

export interface SiteConfig {
  name: string;
  domain: string;
  url: string;
  tagline: string;

  home: {
    description: string;
  };

  github: string;

  about: {
    title: string;
    description: string;
    intro: string;
    paragraphs: string[];
  };

  pages: Record<string, SitePage>;
}

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

  // Shown on /about (the account icon in the top bar). Edit freely.
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
        {
          title: 'Microsoft Activation Scripts | Massgravel',
          description: 'Windows activation scripts, installation resources, and licensing guides.',
          href: 'https://github.com/massgravel/Microsoft-Activation-Scripts',
          tags: ['windows', 'activation', 'github'],
          commands: [
            {
              label: 'PowerShell',
              command: 'irm https://get.activated.win | iex',
            },
          ],
        },
        {
          title: 'WinUtil | Chris Titus Tech',
          description:
            'Windows utility for system tweaks, debloating, updates, and software installation.',
          href: 'https://github.com/ChrisTitusTech/winutil',
          tags: ['windows', 'utility', 'github'],
          commands: [
            {
              label: 'PowerShell',
              command: 'irm https://christitus.com/win | iex',
            },
          ],
        },
      ],
    },

    // Hand-picked favorites: the best-in-class things I actually use.
    // Each child topic is one pick (or one category of picks). Children are
    // reachable from this page and intentionally don't appear in the top nav.
    collections: {
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

      children: [
        {
          type: 'topic',
          slug: 'nuvio',
          title: 'Nuvio',
          description: 'My pick for the best media app, with configuration and setup guides.',
          introduction:
            'A central collection of Nuvio-related resources, addon configurations, metadata providers, and integrations.',

          blocks: [
            {
              type: 'text',
              title: 'About Nuvio',
              content:
                'Nuvio supports HTTPS-based streaming sources, which are more than sufficient for my setup. Debrid integrations are also possible, but I prefer using HTTPS sources. This collection covers useful resources, configurations, and integrations for Nuvio.',
            },
            {
              type: 'links',
              title: 'Main Resources',
              description: 'Essential websites and community resources.',
              items: [
                {
                  title: 'Trakt',
                  description: 'Watch history and list integrations.',
                  href: 'https://app.trakt.tv/home',
                  label: 'Official',
                },
                {
                  title: 'Nuvio',
                  description: 'Official Nuvio website.',
                  href: 'https://nuvio.tv/',
                  label: 'Official',
                },
                {
                  title: 'Nuvio Addons Megathread',
                  description:
                    'Community-maintained megathread featuring Nuvio addons, providers, and related resources.',
                  href: 'https://www.reddit.com/r/nuvioaddons/s/2vecDkz7wb',
                  label: 'Community',
                },
                {
                  title: 'PenguPlay',
                  description: 'HTTPS streaming resources.',
                  href: 'https://pengu.uk/',
                  label: 'Community',
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
                    'Configure AIOStreams to add HTTPS streaming sources, addons, and filters. Debrid integrations are also supported if desired, but are not required.',
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
                        'Configure HTTPS streaming providers, filters, and addon settings for your setup. Debrid integrations are optional.',
                    },
                    {
                      type: 'links',
                      title: 'Configuration',
                      items: [
                        {
                          title: 'AIOStreams Configuration',
                          description: 'Configure stream providers and addon settings.',
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
                      content: 'Configure metadata providers and catalogs for your Nuvio setup.',
                    },
                    {
                      type: 'links',
                      title: 'Configuration',
                      items: [
                        {
                          title: 'AIOMetadata Configuration',
                          description: 'Configure metadata providers and catalogs.',
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
                  content: 'Manage API credentials used by metadata providers and integrations.',
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

        // Template for the next pick, e.g. best Android TV web browser:
        //
        // {
        //   type: 'topic',
        //   slug: 'android-tv-browser',
        //   title: 'Android TV Browser',
        //   description: 'My pick for the best web browser on Android TV.',
        //   blocks: [
        //     { type: 'text', title: 'Why I picked it', content: '...' },
        //     {
        //       type: 'links',
        //       title: 'Get it',
        //       items: [{ title: 'Name', description: '...', href: 'https://...' }],
        //     },
        //   ],
        // },
      ],
    },
  },
} satisfies SiteConfig;
