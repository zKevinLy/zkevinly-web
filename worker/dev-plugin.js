import { loadEnv } from 'vite';
import { handleGif } from './gif.js';
import { handleRepo } from './repo.js';

/**
 * Vite plugin: serves /api/gif during `astro dev` using the same handler as the
 * production Worker. Put GIPHY_API_KEYS (comma-separated if several) in a local .env (git-ignored) to try the
 * chat bot's GIFs locally; without it the bot simply falls back to emoji.
 *
 * Also serves /api/repo (private-repo badges) from a GITHUB_TOKEN in the same .env.
 */
export function gifDevApi() {
  return {
    name: 'gif-dev-api',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');

      server.middlewares.use('/api/gif', async (req, res) => {
        const request = new Request(
          `http://localhost/api/gif${req.url?.replace(/^\/?/, '/') ?? '/'}`,
          {
            method: req.method,
          },
        );
        const response = await handleGif(request, env);

        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(await response.text());
      });

      server.middlewares.use('/api/repo', async (req, res) => {
        const request = new Request(
          `http://localhost/api/repo${req.url?.replace(/^\/?/, '/') ?? '/'}`,
          { method: req.method },
        );
        const response = await handleRepo(request, env);

        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(await response.text());
      });
    },
  };
}
