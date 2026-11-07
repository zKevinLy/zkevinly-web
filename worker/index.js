import { handleGif } from './gif.js';

/**
 * Cloudflare Worker entry. Static files are served from dist/ via the ASSETS
 * binding; only /api/gif is handled here (see run_worker_first in wrangler.toml).
 *
 * Set the key once with:  npx wrangler secret put KLIPY_API_KEY
 */
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/gif') return handleGif(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
