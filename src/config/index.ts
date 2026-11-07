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
      type: 'workflow';
      title: string;
      description?: string;
      phases: WorkflowPhase[];
      nodes: WorkflowNode[];
    }
  | {
      /**
       * Auto-generated index of every page beneath this (hub) page, grouped,
       * with the workflow steps that use each one. Only valid on a `hub` page.
       */
      type: 'index';
      title: string;
      description?: string;
    }
  | {
      type: 'image';
      title?: string;
      src: string;
      alt: string;
      caption?: string;
    };

/** A row in the workflow. Phases read top to bottom; nodes inside a phase are parallel. */
export interface WorkflowPhase {
  id: string;
  title: string;
  description?: string;
}

export type WorkflowBlock = Extract<TopicBlock, { type: 'workflow' }>;

export interface WorkflowNode {
  id: string;
  /** Which phase (row) this step sits in. */
  phase: string;
  title: string;
  description: string;
  /** Primary destination: makes the whole step clickable. */
  href?: string;
  /** Extra destinations, listed on the step with link icons. */
  links?: { label: string; href: string }[];
  /**
   * This node's parents. Every node except the single start node must have at
   * least one, and each parent must sit in an earlier phase. The build fails
   * otherwise, so nothing can float free of the path.
   */
  dependsOn?: string[];
  optional?: boolean;
  branch?: string;
}

export interface TopicPage extends BasePage {
  type: 'topic';
  slug: string;
  introduction?: string;
  /**
   * Marks this page as the hub for everything beneath it. Its workflow must
   * link to every descendant page (checked at build time), its child cards are
   * replaced by the workflow + index, and each descendant shows a trail back
   * to the steps that use it.
   */
  hub?: boolean;
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

// Base path of the Nuvio hub. Every other Nuvio page lives beneath it, so the
// only way in is through the Getting Started path.
const NUVIO_HUB = '/collections/nuvio/getting-started';

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
            'Everything Nuvio-related starts in one place: the Getting Started path. Addons, API providers, provider manifests, and community resources are all reached from the step that needs them.',
          blocks: [],

          children: [
            {
              type: 'topic',
              slug: 'getting-started',
              hub: true,
              title: 'Getting Started',
              description:
                'Start here: the setup path, plus every addon, provider, and resource it connects to.',
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
                    },
                    {
                      id: 'api',
                      phase: 'prepare',
                      title: 'Get your TMDB and TVDB API keys',
                      description:
                        'AIOMetadata requires both a TMDB and a TheTVDB API key. Create them now and keep them handy for the next steps.',
                      href: `${NUVIO_HUB}/api-providers`,
                      dependsOn: ['account'],
                    },
                    {
                      id: 'streams',
                      phase: 'prepare',
                      title: 'Set up AIOStreams as your stream hub',
                      description:
                        'AIOStreams is the one place every stream addon goes through, so its formatting, sorting, and filtering apply to all of your sources. Configure it, add your HTTPS addons inside it (such as PenguPlay), and copy its manifest URL when you’re done.',
                      href: `${NUVIO_HUB}/addons/aiostreams`,
                      links: [
                        { label: 'HTTPS addon · PenguPlay', href: 'https://pengu.uk/' },
                        {
                          label: 'More HTTPS addons · Megathread',
                          href: 'https://www.reddit.com/r/nuvioaddons/s/2vecDkz7wb',
                        },
                      ],
                      dependsOn: ['account'],
                    },
                    {
                      id: 'catalog',
                      phase: 'metadata',
                      title: 'Set up AIOMetadata for your catalogs',
                      description:
                        'AIOMetadata lets you build custom catalogs and organize how your library is laid out. Enter the TMDB and TVDB keys from the previous step, configure it, and copy its manifest URL when you’re done. If your AIOStreams configuration already includes AIOMetadata, don’t install a duplicate.',
                      href: `${NUVIO_HUB}/addons/aiometadata`,
                      dependsOn: ['api'],
                    },
                    {
                      id: 'connect',
                      phase: 'connect',
                      title: 'Add both addons on nuvio.tv',
                      description:
                        'Sign in at nuvio.tv and add each manifest URL there: AIOMetadata first, then AIOStreams, so metadata stays above streams. The website is much faster than the in-app menus, so skip the app for this.',
                      href: 'https://nuvio.tv/',
                      dependsOn: ['catalog', 'streams'],
                    },
                    {
                      id: 'verify',
                      phase: 'verify',
                      title: 'Refresh the app and verify',
                      description:
                        'Open Nuvio and manually refresh so it picks up your addons. This is the only step that needs the in-app UI. Then open a movie and an episode, confirm your catalogs and metadata load, and test playback.',
                      dependsOn: ['connect'],
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
                    },
                  ],
                },
                {
                  // Auto-generated from this page's child pages and the steps that link to them.
                  type: 'index',
                  title: 'Everything in this guide',
                  description:
                    'Every page under Getting Started, grouped, with the setup steps that use it.',
                },
              ],

              children: [
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
                            },
                            {
                              title: 'AIOStreams in Nuvio',
                              description:
                                'Current guide for configuring AIOStreams and installing its manifest.',
                              href: 'https://docs.elfhosted.com/nuvio/aiostreams-nuvio/',
                              label: 'Guide',
                            },
                            {
                              title: 'AIOStreams configuration walkthrough',
                              description:
                                'Community guide with ready-made configurations and stream-list explanations.',
                              href: 'https://www.reddit.com/r/nuvioaddons/comments/1xlg3c0/complete_tutorial_with_configs_for_aiostreams/',
                              label: 'Reddit',
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
                      introduction:
                        'AIOMetadata lets you build custom catalogs and organize how your library is laid out. It requires your TMDB and TVDB API keys, and should sit above AIOStreams so its metadata is prioritized.',
                      blocks: [
                        {
                          type: 'text',
                          title: 'About AIOMetadata',
                          content:
                            'Build custom catalogs and configure metadata for your Nuvio setup.',
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
