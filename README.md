# zkevinly-web

Central site for zkevinly.com: homepage, project directory, resources, tools, experiments, links, notes.

**Stack:** Astro · TypeScript · plain CSS · Lucide icons · GSAP · Astro View Transitions (`ClientRouter`) · Markdown/MDX

## Develop

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # type-check + static build to ./dist

## Where things live

| To change...                              | Edit                        |
| ----------------------------------------- | --------------------------- |
| Name, tagline, nav, GitHub link, About    | `src/config/index.ts`       |
| Entries on projects/resources/tools/etc.  | `src/config/index.ts`       |
| Notes (digital garden)                    | `src/content/notes/*.md(x)` |
| Colors, fonts, light/dark themes, styling | `public/index.css`          |
| Page chrome and animations                | `src/layouts/Layout.astro`  |

## Principles

- One central identity, independently deployable projects. Link out to other repos/subdomains; don't absorb them.
- `*.lab.zkevinly.com` (homelab) stays separate, with its own auth. Do not link private services from here.
- No shared packages until real code reuse justifies one.

## Deploy

Output is fully static (`dist/`). Works as-is on Cloudflare Pages, Netlify, Vercel, or GitHub Pages
(build command `npm run build`, output dir `dist`).

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
  (`src/lib/groups.ts`), so a typo can't make a page vanish.
- A group can also hold `entries` (cards, same as the Directory cards below), shown after its pages. Collections uses
  this for a plain link to the AIO Store repo with a copyable manifest URL.
- Parents without `groups` keep the single "Explore ..." section.

## Directory cards

Cards that link to a GitHub repo automatically show the latest release, star count and
a relative "Updated ..." time (the heartbeat dot pulses if pushed in the last 14 days).
Data is fetched at build time and refreshed in the browser (cached 1 hour).

- Opt out / override the repo: `repo: false` or `repo: 'owner/name'` on the entry.
- Click-to-copy commands: `commands: [{ label: 'PowerShell', command: '...' }]`.
- Non-GitHub entries can set `updated: '2026-01-31'` for a manual "last updated".
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
