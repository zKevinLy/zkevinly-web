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

Every push to `main` that passes CI creates a GitHub Release and a matching `vX.Y.Z` tag, with
generated release notes and the built site attached as a zip. The tag is the version of record
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
