# @zkevinly/ui

The UI for zkevinly sites: components, page layout and styles for [Astro](https://astro.build).

**The rule:** nothing in this package knows about a site's data, config, GitHub or build.
Everything comes in through props, so it is safe to use from any Astro project. Logic that depends
on your data (fetching, install scripts, a chat bot...) stays in the consuming app and hands the
finished values to these components.

Astro components ship as source (`.astro`, `.ts`, `.css`); there is no build step. Needs `astro`,
`@lucide/astro` and `simple-icons` in the consuming project (peer dependencies).

## Install

From GitHub Packages. In the consuming repo, add an `.npmrc` (commit it) and authenticate with a
token that has `read:packages` (a classic PAT locally; `GITHUB_TOKEN` in a GitHub Action with
`packages: read`):

    @zkevinly:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}

then `npm install @zkevinly/ui`. GitHub Packages requires a token even for public packages.

Or straight from a GitHub Release (no registry needed; private repos need a token):

    npm install https://github.com/zKevinLy/zkevinly-web/releases/download/ui-v0.1.0/zkevinly-ui-0.1.0.tgz

Or download the `.tgz` from the Release page and `npm install ./zkevinly-ui-0.1.0.tgz`.

## Use

```astro
---
import Layout from '@zkevinly/ui/layouts/Layout.astro';
import Node from '@zkevinly/ui/base/Node.astro';
import Grid from '@zkevinly/ui/base/Grid.astro';
---

<Layout name="Acme" nav={[{ href: '/docs', label: 'Docs' }]} title="Home">
  <Grid>
    <Node title="Hello" description="A card" href="/hello" />
  </Grid>
</Layout>
```

`Layout` imports the package's styles itself (`@zkevinly/ui/styles`: tokens, element defaults,
header, every component). Add your own stylesheet _after_ importing the layout so yours wins ties.
Without the layout, import `@zkevinly/ui/styles` yourself.

The components read colours, fonts and radii from CSS variables (`--bg`, `--surface`, `--border`,
`--muted`, `--text`, `--accent`, `--radius`, `--font-sans`, `--font-mono`...). Override them after the
import to re-theme. Light mode is `<html data-theme="light">`.

Import components by path, not from a barrel: each component with a `<script>` then only ships on
pages that use it.

## What is in it

| Import                           | Contents                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@zkevinly/ui/base/*.astro`      | Primitives: Avatar, Background, Badge, Breadcrumb, Button, CopyButton, Figure, Freshness, Grid, IconButton, LinkList, NavLink, Node, PageHeader, Prose, Section, Select, Steps, Tags |
| `@zkevinly/ui/composite/*.astro` | Built from the primitives: CommandBlock, FilterBar, Header, HubTrail, RepoMeta, Search, Workflow                                                                         |
| `@zkevinly/ui/layouts/*.astro`   | `Layout`: head, theme, header, `<main>`, search, reveal motion; slots `head` and `end`                                                                                   |
| `@zkevinly/ui/lib/*`             | UI logic: `filter`, `spotlight`, `navigation`, `workflow` (layout + validation), `repo-info` (`applyRepoInfo`), `icon` (`resolveIcon`), `ping` (`applyPing`), `background` (`resolveBackground`), `time`     |
| `@zkevinly/ui/types`             | Prop shapes (`CopyCommand`, `LinkItem`, `TrailStep`, `RepoInfo`, `WorkflowNode`...): structural, so your own richer types are assignable                                 |
| `@zkevinly/ui/styles`            | Everything; or pick files: `styles/base/tokens.css`, `styles/layout/header.css`...                                                                                       |

See each component's header comment for its props and slots.

### Icons and ping on a Node

`<Node icon="si-github" />` puts a picture before the title (`si-<slug>` Simple Icons glyph,
`<name>.svg|png|webp` Dashboard Icons file, a `/path` or an image URL; anything else throws).
`<Node ping />` adds a status dot, rendered as "checking". The app decides what to check and calls
`applyPing(el, result)` on the node's `.node-ping`; the package never makes the request.

### Background

`Layout` takes a Homepage-style `background`: any image URL, plus knobs for how it looks.

```astro
<Layout
  name="Lab"
  nav={nav}
  background={{
    image: 'https://images.unsplash.com/photo-....jpg', // /path, ./path, https://, data:image/
    blur: 'md', // none | sm | md | lg | xl | 2xl | 3xl, or px
    saturate: 80, // percent, 100 = unchanged
    brightness: 60, // percent, 100 = unchanged
    opacity: 90, // 0-100, how much of the image shows over the page colour
    cardBlur: 'md', // blur behind each Node
    cardOpacity: 70, // 0-100, how solid a Node is (lower lets the image through)
  }}
>
```

Only `image` is required; leave out what you don't need. The picture is fixed behind the page and
the page colour stays underneath it, so light and dark themes both work (tune `brightness` per
site). A bad value (unknown blur name, out of range, `javascript:` URL) fails the build. Without
`image` nothing is rendered. Sites with their own shell can render `base/Background.astro` with
the same options; `lib/background` exposes `resolveBackground` if you need the CSS variables.

### Data in, behaviour out

Components never fetch or read site config. A component whose browser behaviour needs your data
exposes a function instead: `RepoMeta` renders from an `info` prop and `applyRepoInfo(foot, info)`
repaints it when your own script has newer data; the filter bar sorts by what `filterAttrs()` wrote.

## Releasing (automatic)

Nothing to do by hand. When a push to `main` changes `packages/ui` and CI passes, the `release-ui` job in
`.github/workflows/ci.yml` works out the next version from the Conventional Commits that touched the
package (`feat:` minor, `feat!:` / `BREAKING CHANGE:` major, anything else patch), stamps it into
`package.json`, tags `ui-vX.Y.Z`, publishes to GitHub Packages (with the built-in `GITHUB_TOKEN`, no secrets to set up) and attaches the
`.tgz` to a GitHub Release. Commits that don't touch the package release nothing. The first release
uses the version already in `package.json`. The `ui-v*` tags are separate from the site's `v*` deploy tags.

Versioning: removing or renaming a component, prop or CSS class is a breaking change (`feat!:`); new
components or optional props are `feat:`. Never edit `version` by hand: CI's `version` job writes it
into `package.json` (and the lockfile) in a `chore(release)` commit and tags that commit.

## Adding a component here

Ask: can it work with props alone? If it imports site config or fetches data, take the data as props
(or expose a function, as above) and keep the fetching in the app. Compose existing components rather
than adding wrappers that only rename another one.

Then it is four files, and nothing else is registered by hand:

1. `src/components/base/Foo.astro` (or `composite/` when built from other components, or `layouts/`).
   It is exported automatically (`exports` uses wildcards) as `@zkevinly/ui/base/Foo.astro`.
2. Its CSS in `src/styles/components/<name>.css`. `styles/index.css` is generated from the style
   folders (`npm run ui:sync`; CI's autofix job also runs it).
3. A fixture page `tests/fixture/src/pages/Foo.astro` with a few `<test-case id="...">` variants.
4. A `describe('Foo', ...)` in `tests/components.test.ts` asserting on the rendered markup.

UI logic that isn't a component goes in `src/lib/<name>.ts` (exported as `@zkevinly/ui/lib/<name>`)
with a unit test in `tests/`.

`npm test` enforces this: `components.guard.test.ts` fails if a component has no fixture page or
`describe`, if a class it uses has no CSS, or if `index.css` is stale, and
`tests/packages/ui-boundary.test.ts` fails if the package imports from the app, or the app
re-implements a package component. `components.test.ts` builds the fixture with Astro and queries
the real rendered HTML (helpers in `tests/helpers/`).
