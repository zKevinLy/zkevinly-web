# zkevinly-web

Central site for zkevinly.com: homepage, project directory, resources, tools, experiments, links, notes.

**Stack:** Astro · TypeScript · plain CSS · Lucide icons · GSAP · Astro View Transitions (`ClientRouter`) · Markdown/MDX

## Develop

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # type-check + static build to ./dist

## Where things live

| To change...                              | Edit                          |
| ----------------------------------------- | ----------------------------- |
| Name, tagline, nav, GitHub link, About    | `src/config/index.ts`         |
| Entries on projects/resources/tools/etc.  | `src/config/index.ts`         |
| Notes (digital garden)                    | `src/content/notes/*.md(x)`   |
| Colors, fonts, light/dark themes, styling | `public/index.css`            |
| Page chrome and animations                | `src/layouts/Layout.astro`    |

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
