# Components

**The UI lives in `packages/ui` (`@zkevinly/ui`)**: every base component (Button, Node, Badge...),
the larger ones built from them (Header, Search, FilterBar, Workflow, RepoMeta, CommandBlock...)
and the page shell (`layouts/Layout.astro`). See `packages/ui/README.md`. This site imports
them like any consumer: `import Node from '@zkevinly/ui/base/Node.astro'`.

This folder is only what is specific to this site: features that carry business logic or content
knowledge. They fetch, map and decide, then hand finished values to the package as props.

| Component     | What it does                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `EntryCard`   | A directory entry: fetches repo info, builds filter attributes, lays out Node + RepoMeta        |
| `TopicBlocks` | Renders a topic page's content blocks (this site's content model) with package components       |
| `HubIndex`    | The hub's index: pages beneath it and the workflow steps that use them                          |
| `Installer`   | Batch-install script + APK links (Android TV apps): UI from the package, logic in `lib/install` |
| `ChatBot`     | The chat bot (config in `config/chatbot.ts`)                                                    |

The PDF toolkit (`pages/toolkit`, `lib/toolkit`, `styles/toolkit`) is the other app-only feature.

## Rules

1. App code depends on the package, never the reverse. `tests/packages/ui-boundary.test.ts` fails
   if the package imports from `src/`, or if `src/` re-implements a package component.
2. Don't add a component that only wraps or renames another. Compose the base components in the
   place that needs them; extract a component when two or more places repeat the same markup.
3. Need something the package's components can't express (a variant, a slot)? Extend the
   package's component (and its tests) rather than copying its markup or classes here.
4. Business logic (data, fetching, scripts that need site data) stays here; the package's scripts
   only do UI behaviour. Where a component needs data-driven behaviour in the browser, the package
   exposes a function (e.g. `applyRepoInfo`) and the app's script calls it with its own data.
5. Styles for these components live in `src/styles/components/`, imported from `src/styles/global.css`.
