# Changelog

## 0.3.0

- **Breaking:** `IconButton` and `CopyButton` are gone; `Button` does both. Use `variant="icon"` (with `label`
  and `tooltip`), `copy="text"` (optionally `variant="segment"`), `size="sm"`, `current`, `navHref`.
  `MoveButtons` and `ReorderToolbar` now render `Button`.
- Classes: `.icon-btn` -> `.btn .btn-icon`, `.copy-btn` -> `.btn .btn-segment` (+ `.btn-text`,
  `.btn-icon-copy`, `.btn-icon-done`). `icon-button.css` is merged into `button.css`.

## 0.2.0

- Reorder kit moved in from lab: `base/DragHandle`, `base/MoveButtons`, `base/ReorderColumns`,
  `base/ViewInit`, `composite/ReorderToolbar`, `lib/order` (TypeScript), `lib/reorder` (the browser
  script) and `styles/components/reorder.css`. Grid/list view, 1-4 columns and per-browser reordering.
- Class names and attributes are `reorder-*` / `data-reorder-*` (were `lab-*`); the page container is
  `[data-reorder-scope="<page>"]`. localStorage keys are `ui:view` and `ui:order:<scope>`, so saved
  layouts from the old `lab:*` keys reset once.
- `Dashboard` + `DashboardGroup` (composite): the page frame (scope, toolbar, filter bar, columns) and
  one reorderable titled grid. 3-4 column grids at wide widths are the default (`dashboard.css`).
- `lib/ping-refresh`: the shared status-dot loop (`startPingRefresh({ check, key, intervalMs })`) plus
  `pingViaEndpoint` and `pingViaBrowser`; apps supply only the check.

## Unreleased

- Pages now render instantly: removed the entrance animation on load (`reveal.css`, `data-reveal`,
  and the `reveal` prop on `Node`, `Prose` and `Section`) and the cross-fade between pages
  (`<main transition:animate="none">` plus a global `::view-transition-*` override). Hover
  transitions and intentional pulses (ping, freshness heartbeat, search spotlight) are unchanged.
  Removed `card-motion.css`, which only existed to undo the reveal on filterable items.
- `FilterBar`: listens for the new `FILTER_ORDER_EVENT` (`lib/filter`). A page that lets people
  reorder its own items fires it, and the bar takes the DOM's current order as "Default order"
  instead of undoing it on the next filter or sort change.
- `Layout`: optional `background` (Homepage-style): an image URL with `blur`, `saturate`,
  `brightness`, `opacity`, plus `cardBlur` / `cardOpacity` for the cards over it. New
  `base/Background` (the fixed image layer) and `lib/background` (`resolveBackground`, validates
  at build time). New type `BackgroundOptions`.
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
