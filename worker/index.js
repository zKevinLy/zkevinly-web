import { handleGif } from './gif.js';

/**
 * Cloudflare Worker entry. Static files are served from dist/ via the ASSETS
 * binding; only /api/gif is handled here (see run_worker_first in wrangler.toml).
 *
 * Set the key(s) once with:  npx wrangler secret put GIPHY_API_KEYS
 * (one key, or several separated by commas)
 */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/gif') return handleGif(request, env);
    return env.ASSETS.fetch(request);
  },
};
