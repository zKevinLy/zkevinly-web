# zkevinly-web

Central site for zkevinly.com: homepage, project directory, resources, tools, experiments, links, notes.

**Stack:** Astro · TypeScript · plain CSS · Lucide icons · GSAP · Astro View Transitions (`ClientRouter`) · Markdown/MDX

## Develop

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # type-check + static build to ./dist

## Where things live

| To change...                               | Edit                                             |
| ------------------------------------------ | ------------------------------------------------ |
| Name, tagline, About text                  | `src/config/index.ts`                            |
| Projects / Resources / Collections entries | `src/config/{projects,resources,collections}/`   |
| Toolkit tool list (cards, tests)           | `src/config/toolkit/index.ts`                    |
| Colors, fonts, light/dark themes           | `packages/ui/src/styles/base/tokens.css`         |
| Header, search, filter bar, any shared UI  | `packages/ui/src/` (components, layouts, styles) |
| Styling for an app component               | `src/styles/components/<component>.css`          |
| Toolkit tool styling                       | `src/styles/toolkit/`                            |
| Page shell (head, header, search, motion)  | `packages/ui/src/layouts/Layout.astro`           |
| What the shell is fed (nav, name, version) | `src/lib/ui/shell.ts`                            |
| Security headers / CSP                     | `public/_headers`                                |

## Project layout

    src/
      components/     this site's own features, built from @zkevinly/ui: ChatBot, Installer,
                      TopicBlocks (content -> UI), EntryCard, HubIndex
      config/
        index.ts, types.ts   site name/tagline/About, shared types
        projects/ resources/ collections/   one folder per section (these drive /projects etc.)
        toolkit/      the tool list for /toolkit
        shared/       entries reused by several sections
        chatbot.ts
      layouts/        thin wrappers around the package's Layout: Layout.astro (+ chat bot), Toolkit.astro
      templates/      page types rendered inside Layout: Directory.astro, Topics.astro
      lib/
        topics/       topic-page structure: groups, hub, workflow
        install/      batch-install script builder: installer, commands
        ui/           site-specific UI helpers: navigation, shell, filter-sources, chatbot
      scripts/        browser scripts that need site data (repo-refresh)
        toolkit/      one folder per tool (pdf/)
        github.ts     repo release/star lookups
      pages/          routes. [section] and [...slug] render config-driven pages; toolkit/ is hand-written
      styles/
        global.css    imports everything below, in cascade order
        components/ pages/   styles for this site's own components and page types (the rest is in packages/ui)
        toolkit/      tool styles, loaded by the Toolkit layout only
    packages/
      ui/             @zkevinly/ui: all shared UI (components, layout, styles, UI logic), no site data (own README)
    tests/            mirrors src/ (config/, lib/<group>/, worker/); the package keeps its own in packages/ui/tests/
    worker/           Cloudflare Worker (/api/*)
    public/           static files copied as-is

## Principles

- One central identity, independently deployable projects. Link out to other repos/subdomains; don't absorb them.
- `*.lab.zkevinly.com` (homelab) stays separate, with its own auth. Do not link private services from here.
- UI lives in `packages/ui` (`@zkevinly/ui`), published for other repos; site data and business logic (config, GitHub lookups, install scripts, the chat bot, the PDF toolkit) stay in `src/` and are passed in as props. Nothing in the package may import from `src/`.
- Build big components out of small ones: base components (Button, Node, Badge...) are composed into larger ones; don't add wrapper components that only rename or re-wrap another.

## Deploy

The pages are static (`dist/`), but the site is deployed as a Cloudflare Worker (`wrangler.toml`):
the Worker serves `dist/` as assets and handles `/api/gif`, `/api/repo` and `/api/ping`. `public/_headers`
carries the security headers, including the strict policy for `/toolkit`. Deploy with
`npm run build:fast && npm run deploy` (CI does this on every push to `main`). Other static hosts
will serve the pages but not the API routes or the headers.

## Docker (alternative host)

The Cloudflare Worker stays the production host. The same site also runs as a container, so it can be
hosted anywhere (`server/node.mjs` serves `dist/` with the `_headers` rules and runs the Worker's own
`/api/*` handlers; nothing is duplicated).

```sh
docker compose up -d --build          # http://localhost:8080 (WEB_PORT to change)
docker build -t zkevinly-web .        # or build the image directly
```

Settings go in `.env` (see `.env.example`): `GIPHY_API_KEYS` for chat GIFs, `GITHUB_TOKEN` for private-repo
badges at runtime. To bake release/commit badges for the project cards in at build time, pass the token as a
build secret: `docker build --secret id=github_token,env=GITHUB_TOKEN .`. `/healthz` is the health check.
Run `npm run build:fast && npm run start:node` to try the Node host without Docker.

## Toolkit (`/toolkit`)

Small tools that run entirely in the browser (first one: the PDF generator at `/toolkit/pdf`, which makes invoices, service logs and custom documents; the old `/toolkit/invoice` link redirects there).
Unlike the config-driven sections, each tool is a hand-written page in `src/pages/toolkit/`, listed
in `src/config/toolkit/index.ts` so it gets a card and a test.

- To add a tool, one thing per place:
  - page: `src/pages/toolkit/<slug>.astro` (use `layouts/Toolkit.astro`)
  - logic: `src/lib/toolkit/<slug>/`, with tests in `tests/lib/toolkit/<slug>/`
  - styles: `src/styles/toolkit/<slug>.css`, imported by the page (shared form/preview styles are in `tool.css`)
  - config: an entry in `src/config/toolkit/index.ts` (the config test fails if the page is missing)
- Toolkit pages use `layouts/Toolkit.astro`: no `ClientRouter` (so entering and leaving the toolkit is a
  full page load) and no chat bot. That is what lets the strict Content-Security-Policy in
  `public/_headers` (`/toolkit` and `/toolkit/*`) apply: tools can only talk to this origin.
- Never write sensitive tool data to `localStorage`, `sessionStorage` or IndexedDB. Persistence is a
  file the user downloads and loads back.

## Hub pages (no floating nodes)

A topic page with `hub: true` (currently Collections → Nuvio → **Getting Started**) is the only way
into everything beneath it. Pages hang off the hub as children, and the hub's `workflow` block is the
map that links to them. The build enforces the rules, so nothing can be left floating:

- **One start node; every other node has a parent.** `dependsOn` lists a node's parents, and a node
  with none (other than the start) fails the build.
- **Parents sit in an earlier phase.** Phases are the rows you read top to bottom; nodes in the same
  phase are parallel branches, so the graph always flows downward and can't loop.
- **Every page under the hub must be linked from a step** (`href` or `links`), or the build fails.
- The hub's `{ type: 'index' }` block auto-lists all of its pages with the steps that use them, and
  each page under the hub shows a "Part of / Used in" trail back to those steps.

To add a page to a hub, add it to the hub's `children`, then link it from the step that needs it. To
add a step, give it a `phase` and a `dependsOn`. Hover or focus a step on the page to trace everything
it requires and unlocks.

## Grouped child pages

A topic page can split its child pages into titled sections instead of one "Explore ..." grid. Collections
does this: **Collections** (the picks themselves) and **Guides** (my own walkthroughs).

- Declare the sections on the parent with `groups: [{ id, title, description? }]`; their order is the display order.
- Put each child in one with `group: '<id>'`. A child with a missing or unknown group fails the build
  (`src/lib/topics/groups.ts`), so a typo can't make a page vanish.
- A group can also hold `entries` (cards, same as the Directory cards below), shown after its pages. Collections uses
  this for a plain link to the AIOStore repo with a copyable manifest URL.
- Parents without `groups` keep the single "Explore ..." section.

## Directory cards

Cards that link to a GitHub or GitLab (gitlab.com) repo automatically show the latest release, star count and
a relative "Updated ..." time (the heartbeat dot pulses if pushed in the last 14 days).
Data is fetched at build time and refreshed in the browser (cached 1 hour).

- Opt out / override the repo: `repo: false`, `repo: 'owner/name'` (GitHub) or
  `repo: 'gitlab:group/project'` (GitLab) on the entry. GitLab is read anonymously, so public projects only.
- Click-to-copy commands: `commands: [{ label: 'PowerShell', command: '...' }]`.
- Entries on other hosts can set `updated: '2026-01-31'` for a manual "last updated".
- Set `GITHUB_TOKEN` in the build environment to avoid GitHub's 60 requests/hour
  unauthenticated limit (in GitHub Actions: `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`).

## Icons and ping

Any card can carry a picture before its name, like Homepage's Icon + Name. Nothing uses one yet.
Set `icon` on an entry, a `links` item or a topic page (a workflow step takes it too):

- `icon: 'si-github'`: a [Simple Icons](https://simpleicons.org) brand glyph, inlined and coloured like the text.
- `icon: 'jellyfin.svg'` (or `.png`, `.webp`): a [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons)
  file, loaded from jsDelivr. Names are kebab-case, as on that site.
- `icon: '/logo.png'`: a file in `public/`. `icon: 'https://example.com/i.png'`: any image URL.

An icon the UI can't place (a typo'd `si-` slug, an unknown form) fails the build and `npm test`.

An entry can also show a live status dot with the response time, like Homepage's ping:

```ts
{ title: 'Docs', href: 'https://docs.example.com/', ping: true }
{ title: 'Jellyfin', href: 'https://jf.example.com/', ping: { url: 'https://jf.example.com/health' } }
{ title: 'NAS', href: 'http://nas.lan/', ping: { via: 'browser' } }
```

- `via: 'worker'` (default): `/api/ping` checks from Cloudflare. Up means the host answered with
  anything below 500 (a redirect or a 401 still counts); down is no answer in 5 s, an error or a 5xx.
  It is an HTTP check, not an ICMP ping, and it only ever requests URLs listed in the config, so it
  can't be used to probe other hosts. It can't see private/LAN addresses.
- `via: 'browser'`: the visitor's own browser makes the request, the only way to see LAN hosts. It
  can't read the status code, so it means "something answered", and what it shows is true for that
  visitor only. An `https` page can't check plain `http` hosts (mixed content), and newer browsers may
  ask permission before a public page may reach the local network.

Dots refresh every minute while the tab is visible. Private hostnames put in this public config are
visible in the page source, so keep homelab entries on their own site (see Principles).

## Releases

Every push to `main` that passes CI first gets its versions decided and written into the repo, then
is deployed to Cloudflare Workers (`wrangler.toml`, using the `CLOUDFLARE_ACCOUNT_ID` /
`CLOUDFLARE_API_TOKEN` secrets in the `prod` environment), then tagged: a GitHub Release and a
matching `vX.Y.Z` tag are created, with generated release notes and the built site attached as a
zip. A failed deploy means no tag. If a push contains several commits, the highest applicable bump
wins. Releases follow
[Conventional Commits](https://www.conventionalcommits.org/):

| Commit message                                                    | Effect                             |
| ----------------------------------------------------------------- | ---------------------------------- |
| `feat: add dark mode`                                             | minor bump                         |
| `feat!: rework the layout` or a `BREAKING CHANGE:` footer         | major bump, including before 1.0.0 |
| Any other commit, including `fix:`, `deps:`, `chore:` and `docs:` | patch bump                         |

When squash-merging a PR, the PR title becomes the commit message, so write it as
`feat: ...` / `feat!: ...` to trigger a minor / major release.

### Versions are written by CI, never by hand

The `version` job in `.github/workflows/ci.yml` runs once per push to `main`, after the checks pass:

1. `next-version.sh` picks the site's next `vX.Y.Z`; `next-ui-version.sh` picks the UI package's next
   `ui-vX.Y.Z` (or nothing when `packages/ui` didn't change).
2. `set-version.mjs` writes those into every file that carries a version: `package.json`,
   `packages/ui/package.json` and `package-lock.json`.
3. One `chore(release): vX.Y.Z [skip ci]` commit holds that. The deploy and the UI release build
   and tag _that_ commit, so every tag points at files that say the same version.

So the `version` fields in the repo always match the latest tags, and nobody edits them. The build is
also stamped (shown on the About page and in `/version.json`). Anything new that carries a version
gets added to `.github/scripts/set-version.mjs` (its tests are in `tests/ci/`). To preview the next
tags locally: `bash .github/scripts/next-version.sh` and `bash .github/scripts/next-ui-version.sh`.
The version commit is pushed with `GITHUB_TOKEN`, so branch rules on `main` must let the Actions bot
push (the auto-fix commit already needs that).

## Chat bot GIFs (GIPHY)

The bottom-right chat bot answers with GIFs: each message the visitor sends is turned
into a short search query and looked up on [GIPHY](https://giphy.com). Nothing is
hard-coded per message. If the search is unavailable or finds nothing, the bot falls
back to the emoji rules in `src/config/chatbot.ts`.

The browser never calls GIPHY directly. Instead `/api/gif` is a tiny Cloudflare Worker
route (`worker/`) that holds the key and does the search. Visitor text is used only for
that search: it isn't logged or stored, and no IP/cookies are forwarded. Responses are
not cached, in line with GIPHY's guidelines.

The chat panel always shows a "Powered by GIPHY" attribution (required by GIPHY's API
terms); keep it if you restyle the bot. For a production key GIPHY may also ask for the
official logo marks, which are available at <https://developers.giphy.com/branding/>.

**Production:** create a free key at <https://developers.giphy.com> (choose "API"), then

```sh
npx wrangler secret put GIPHY_API_KEYS
npm run deploy
```

`GIPHY_API_KEYS` takes one key, or several separated by commas (`key1,key2,key3`). Each
search picks one at random, and if GIPHY rejects that key (invalid or rate limited) the
Worker tries the next. `GIPHY_API_KEY` (a single key) also still works.

Optional: set `GIPHY_RATING` (a Worker variable) to `g`, `pg`, `pg-13` or `r` to change the
default `pg`. New keys are "beta" keys limited to about 100 requests per hour, so consider a
Cloudflare rate-limiting rule on `/api/*` so nobody can burn your quota.

**Local:** copy `.env.example` to `.env`, add the key, and run `npm run dev`. Without a
key everything still works; the bot just replies with emoji.

Tuning (search bias word, timeout) lives in `gifSearch` in `src/config/chatbot.ts`.
