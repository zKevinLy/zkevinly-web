# zkevinly-web

Central site for zkevinly.com: homepage, project directory, resources, tools, experiments, links, notes.

**Stack:** Astro · TypeScript · plain CSS · Lucide icons · GSAP · Astro View Transitions (`ClientRouter`) · Markdown/MDX

## Develop

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # type-check + static build to ./dist

## Where things live

| To change...                               | Edit                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| Name, tagline, About text                  | `src/config/index.ts`                                       |
| Projects / Resources / Collections entries | `src/config/{projects,resources,collections}/`              |
| Toolkit tool list (cards, tests)           | `src/config/toolkit/index.ts`                               |
| Colors, fonts, light/dark themes           | `src/styles/base/tokens.css`                                |
| Styling for one component                  | `src/styles/components/<component>.css`                     |
| Toolkit tool styling                       | `src/styles/toolkit/`                                       |
| Page chrome and animations                 | `src/layouts/Layout.astro`, or `Toolkit.astro` for /toolkit |
| Security headers / CSP                     | `public/_headers`                                           |

## Project layout

    src/
      components/
        base/         generic primitives (Node, Badge, Grid...)
        composite/    built from base components; know about site data
      config/
        index.ts, types.ts   site name/tagline/About, shared types
        projects/ resources/ collections/   one folder per section (these drive /projects etc.)
        toolkit/      the tool list for /toolkit
        shared/       entries reused by several sections
        chatbot.ts
      layouts/        document shells: Layout.astro (site), Toolkit.astro (/toolkit)
      templates/      page types rendered inside Layout: Directory.astro, Topics.astro
      lib/
        topics/       topic-page structure: groups, hub, workflow
        install/      batch-install script builder: installer, commands
        ui/           browser/UI helpers: navigation, filter, spotlight, chatbot
        toolkit/      one folder per tool (pdf/)
        github.ts     repo release/star lookups
      pages/          routes. [section] and [...slug] render config-driven pages; toolkit/ is hand-written
      styles/
        global.css    imports everything below, in cascade order
        base/ layout/ components/ pages/   one file per component or page type
        toolkit/      tool styles, loaded by the Toolkit layout only
    tests/            mirrors src/ (config/, lib/<group>/, worker/)
    worker/           Cloudflare Worker (/api/*)
    public/           static files copied as-is

## Principles

- One central identity, independently deployable projects. Link out to other repos/subdomains; don't absorb them.
- `*.lab.zkevinly.com` (homelab) stays separate, with its own auth. Do not link private services from here.
- No shared packages until real code reuse justifies one.

## Deploy

The pages are static (`dist/`), but the site is deployed as a Cloudflare Worker (`wrangler.toml`):
the Worker serves `dist/` as assets and handles `/api/gif` and `/api/repo`. `public/_headers`
carries the security headers, including the strict policy for `/toolkit`. Deploy with
`npm run build:fast && npm run deploy` (CI does this on every push to `main`). Other static hosts
will serve the pages but not the API routes or the headers.

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

## Releases

Every push to `main` that passes CI is deployed to Cloudflare Workers (`wrangler.toml`, using the
`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` secrets in the `prod` environment), then tagged:
a GitHub Release and a matching `vX.Y.Z` tag are created, with generated release notes and the
built site attached as a zip. A failed deploy means no tag. The tag is the version of record
(`package.json` is only the starting point before the first tag). If a push contains several
commits, the highest applicable bump wins. Releases follow
[Conventional Commits](https://www.conventionalcommits.org/):

| Commit message                                                    | Effect                             |
| ----------------------------------------------------------------- | ---------------------------------- |
| `feat: add dark mode`                                             | minor bump                         |
| `feat!: rework the layout` or a `BREAKING CHANGE:` footer         | major bump, including before 1.0.0 |
| Any other commit, including `fix:`, `deps:`, `chore:` and `docs:` | patch bump                         |

When squash-merging a PR, the PR title becomes the commit message, so write it as
`feat: ...` / `feat!: ...` to trigger a minor / major release.

The deployed build is stamped with its version (shown on the About page and in `/version.json`).
The logic lives in `.github/scripts/next-version.sh` and can be run locally to preview the next tag:
`bash .github/scripts/next-version.sh`.

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
