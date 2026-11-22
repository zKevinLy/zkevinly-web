// Prop and data shapes for the UI. Deliberately structural and free of any app/business types:
// an app's richer types (its own entries, pages, config) are assignable to these.

/** One labelled, copy-able shell command (CommandBlock). */
export interface CopyCommand {
  label?: string;
  command: string;
}

/** A row in a LinkList: a link to a page, or a file to download. */
export interface LinkItem {
  /** Small caps label above the row, e.g. "Setup guide". */
  label?: string;
  /** Row text. For a download this is usually the file name. */
  title: string;
  href: string;
  /** Makes the row a download link with this file name. */
  download?: string;
  /** Button text. Defaults to Download / Open (external) / View (internal). */
  action?: string;
}

/** A step chip shown in HubTrail. */
export interface TrailStep {
  id: string;
  number: number;
  title: string;
}

/** What RepoMeta shows about a repository. */
export interface RepoInfo {
  /** ISO timestamp of the most recent push. */
  pushedAt: string;
  stars: number;
  /** Tag of the newest published (non-draft) release, pre-releases included, if any. */
  version: string | null;
  releaseUrl: string | null;
  /** True when `version` is a pre-release (beta, RC, nightly…). */
  prerelease: boolean;
  /**
   * True when the host says the repo is private. The browser has no token, so it must not try
   * to refresh these: it would only get a 404.
   */
  private: boolean;
}

export interface WorkflowPhase {
  id: string;
  title: string;
  description?: string;
}

export interface WorkflowNode {
  id: string;
  /** Which phase (row) this step sits in. */
  phase: string;
  title: string;
  description: string;
  /** Picture before the title (see Node's `icon`). */
  icon?: string;
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
