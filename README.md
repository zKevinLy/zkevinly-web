# zkevinly-web

Central site for zkevinly.com: homepage, project directory, resources, tools, experiments, links, notes.

**Stack:** Astro 5 · TypeScript · Tailwind CSS v4 · GSAP · Astro View Transitions (`ClientRouter`) · Markdown/MDX

## Develop

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # type-check + static build to ./dist

## Where things live

| To change...                              | Edit                          |
| ----------------------------------------- | ----------------------------- |
| Name, tagline, nav, GitHub link           | `src/data/site.ts`            |
| Entries on projects/resources/tools/etc.  | `src/data/site.ts`       |
| Notes (digital garden)                    | `src/content/notes/*.md(x)`   |
| Colors and fonts                          | `src/styles/global.css`       |
| Page chrome and animations                | `src/layouts/Layout.astro`    |

## Principles

- One central identity, independently deployable projects. Link out to other repos/subdomains; don't absorb them.
- `*.lab.zkevinly.com` (homelab) stays separate, with its own auth. Do not link private services from here.
- No shared packages until real code reuse justifies one.

## Deploy

Output is fully static (`dist/`). Works as-is on Cloudflare Pages, Netlify, Vercel, or GitHub Pages
(build command `npm run build`, output dir `dist`).
