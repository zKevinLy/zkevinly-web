import { handleGif } from './gif.js';
import { handlePing } from './ping.js';
import { handleRepo } from './repo.js';

/**
 * Cloudflare Worker entry. Static files are served from dist/ via the ASSETS
 * binding; only /api/gif, /api/repo and /api/ping are handled here (wrangler.toml's
 * run_worker_first sends all of /api/* to this Worker).
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
    if (pathname === '/api/ping') return handlePing(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
