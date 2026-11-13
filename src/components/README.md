# Components

Two layers, one direction of dependency: **composite → base**, never the reverse.

## `base/` — primitives

Generic, content-agnostic building blocks. They know about markup, CSS classes
and behaviour, but nothing about this site's data (`Entry`, `TopicBlock`, GitHub…).

| Component    | Purpose                                                      |
| ------------ | ------------------------------------------------------------ |
| `Node`       | The only card/step. Title, number, link, check-off, slots    |
| `Badge`      | Small pill, link or span                                     |
| `Tags`       | Row of tag pills                                             |
| `Freshness`  | "Updated 3 days ago" + heartbeat dot (owns the time refresh) |
| `CopyButton` | Click-to-copy (owns the one delegated copy handler)          |
| `IconButton` | Square icon control with tooltip, `<a>` or `<button>`        |
| `Button`     | Text link styled as a button                                 |
| `NavLink`    | Top-level nav link                                           |
| `Grid`       | Responsive card grid                                         |
| `Section`    | Optional title + note around content                         |
| `PageHeader` | h1 + lead paragraph                                          |
| `Prose`      | Running text paragraph                                       |
| `Steps`      | Numbered list                                                |
| `Figure`     | Image + caption                                              |
| `Breadcrumb` | Breadcrumb trail                                             |

## `composite/` — built from base (or other composite) components

May know about site data and wire primitives together.

| Component                      | Built from                                                     |
| ------------------------------ | -------------------------------------------------------------- |
| `EntryCard`                    | `Node` + `Tags` + `CommandList` + `RepoMeta`                   |
| `Workflow`                     | `Node` (one per step) + phase rows + trace/check-off           |
| `Installer`                    | `CommandBlock` + device dropdown; reads `EntryCard` checkboxes |
| `HubIndex`                     | `Node` + `Grid`                                                |
| `CommandBlock` → `CommandList` | `CopyButton`                                                   |
| `RepoMeta`                     | `Badge` + `Freshness` (+ GitHub live data)                     |
| `DownloadButton`               | (classes shared with `CommandBlock` / related links)           |
| `TopicBlocks`                  | `Section`, `Prose`, `Grid`, `Steps`, `Figure`, `Node`          |
| `Header`                       | `IconButton`, `NavLink`                                        |
| `FilterBar`                    | (self-contained; acts on `data-filter-*` cards)                |
| `Search`                       | (self-contained overlay)                                       |

## Rules

1. Need a new card, tile, or step? Use `Node` (extend its props if it can't express it). Do not
   write a second card component or hand-write `<div class="node">`.
2. Need new behaviour (copy, relative time, live data)? It lives in exactly one
   component, with its `<script>` next to its markup.
3. Pages and layouts only assemble components; they don't carry their own markup
   for things a component already covers.
4. Styling for a component lives in `public/index.css` under that component's
   section. Prefer extending a base component's props over adding a one-off class.
