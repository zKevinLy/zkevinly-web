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

## Chat bot GIFs (KLIPY)

The bottom-right chat bot answers with GIFs: each message the visitor sends is turned
into a short search query and looked up on [KLIPY](https://klipy.com). Nothing is
hard-coded per message. If the search is unavailable or finds nothing, the bot falls
back to the emoji rules in `src/config/chatbot.ts`.

KLIPY puts the API key in the request URL, so the browser never calls it directly.
Instead `/api/gif` is a tiny Cloudflare Worker route (`worker/`) that holds the key and
does the search. Visitor text is used only for that search: it isn't logged or stored,
and no IP/cookies are forwarded. Results are cached by query for an hour.

**Production:** create a free key at <https://partner.klipy.com>, then

```sh
npx wrangler secret put KLIPY_API_KEY
npm run deploy
```

Optional: set `KLIPY_CONTENT_FILTER` (a Worker variable) to change the default `medium`.
Consider a Cloudflare rate-limiting rule on `/api/*` so nobody can burn your quota.

**Local:** copy `.env.example` to `.env`, add the key, and run `npm run dev`. Without a
key everything still works; the bot just replies with emoji.

Tuning (search bias word, timeout) lives in `gifSearch` in `src/config/chatbot.ts`.
