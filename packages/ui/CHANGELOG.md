# Changelog

## Unreleased

- `Node`: optional `icon` (a picture before the title, Homepage-style) taking `si-<slug>` (Simple
  Icons), `<name>.svg|png|webp` (Dashboard Icons), a `/path` or an image URL; unknown values fail the
  build. New `lib/icon` (`resolveIcon`). `WorkflowNode` takes `icon` too.
- `Node`: optional `ping` adds a status dot (with response time) to the top-right cluster. New
  `lib/ping` (`applyPing`, `pingView`) paints it; the app decides what to check.
- Tokens: `--danger`.

## 0.1.0

First extraction from the site. All shared UI, no site data, config or fetching.

- Layout: `Layout` (head, theme, header, `<main>`, search, reveal motion; `head` / `end` slots,
  optional view transitions)
- Base: `Avatar`, `Badge`, `Breadcrumb`, `Button` (link or `<button>`, `primary`, forwards attributes),
  `CopyButton`, `Figure`, `Freshness`, `Grid`, `IconButton`, `LinkList` (related pages, external
  links, downloads), `NavLink`, `Node`, `PageHeader`, `Prose`, `Section`, `Select`, `Steps`, `Tags`
- Composite: `CommandBlock` (takes a list), `FilterBar`, `Header`, `HubTrail`, `RepoMeta`, `Search`,
  `Workflow`
- Lib: `filter`, `spotlight`, `navigation`, `workflow`, `repo-info` (`applyRepoInfo`), `time`
- Styles: `@zkevinly/ui/styles` (tokens, element defaults, header, every component)
