import { handleGif } from './gif.js';
import { handleRepo } from './repo.js';

/**
 * Cloudflare Worker entry. Static files are served from dist/ via the ASSETS
 * binding; only /api/gif and /api/repo are handled here (list both under run_worker_first in
 * wrangler.toml).
 *
 * Secrets, set once each:
 *   npx wrangler secret put GIPHY_API_KEYS   (one key, or several separated by commas)
 *   npx wrangler secret put GITHUB_TOKEN     (read-only PAT for the private project repos)
 */
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/gif') return handleGif(request, env);
    if (pathname === '/api/repo') return handleRepo(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
