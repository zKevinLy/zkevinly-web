export interface CopyCommand {
  label?: string;
  command: string;
}

/** A button on a card that jumps to a related page on this site (or anywhere). */
export interface RelatedLink {
  /** Small caps label above the button, e.g. "Setup guide". */
  label?: string;
  /** Button text. */
  title: string;
  href: string;
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
  /**
   * The repo is private. The browser then reads release/star info through the Worker's
   * /api/repo (which holds the token) and never calls api.github.com itself, even when
   * the build couldn't read the repo (missing or wrong token).
   */
  repoPrivate?: boolean;
  /** Click-to-copy commands shown on the card. */
  commands?: CopyCommand[];
  /** Buttons that connect this card to related pages (e.g. an app → its setup guide). */
  related?: RelatedLink[];
  /** Manual "last updated" (ISO date) for entries that aren't on GitHub. */
  updated?: string;
}

interface BasePage {
  title: string;
  description: string;
  showInNav?: boolean;
  /**
   * Show the page's filter/search/sort bar even when the list is short
   * (normally it needs MIN_FILTER_ITEMS items).
   */
  alwaysFilter?: boolean;
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
  tags?: string[];
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
      /** A grid of rich cards (release tag, stars, updated date, copy commands). */
      type: 'entries';
      title?: string;
      description?: string;
      items: Entry[];
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
       * Auto-generated index of every page beneath this (hub) page,
       * grouped with the workflow steps that use each one.
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
   * This node's parents. Every node except the single start node must have
   * at least one, and each parent must sit in an earlier phase.
   */
  dependsOn?: string[];
  optional?: boolean;
  branch?: string;
  tags?: string[];
}

/** A titled section on a topic page that its child pages are listed under. */
export interface TopicGroup {
  id: string;
  title: string;
  description?: string;
  /** Cards shown in this section after its child pages (e.g. a link straight to a repo). */
  entries?: Entry[];
}

export interface TopicPage extends BasePage {
  type: 'topic';
  slug: string;
  /**
   * Splits this page's child pages into titled sections (e.g. Collections / Guides).
   * Every child must then name one of these ids in `group`. Without `groups`, the
   * children share a single "Explore …" section.
   */
  groups?: TopicGroup[];
  /** Which of the parent's `groups` this page is listed under. */
  group?: string;
  /** Shown on this page's card in its parent's "Explore" grid. */
  tags?: string[];
  introduction?: string;
  /**
   * Marks this page as the hub for everything beneath it.
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
