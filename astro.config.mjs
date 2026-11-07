// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { gifDevApi } from './worker/dev-plugin.js';

export default defineConfig({
  site: 'https://zkevinly.com',
  integrations: [mdx()],
  // Nuvio's addons, API providers, and provider manifests now live under the
  // Getting Started hub. Keep the old URLs working.
  redirects: {
    '/collections/nuvio/addons': '/collections/nuvio/getting-started/addons',
    '/collections/nuvio/addons/aiostreams': '/collections/nuvio/getting-started/addons/aiostreams',
    '/collections/nuvio/addons/aiometadata': '/collections/nuvio/getting-started/addons/aiometadata',
    '/collections/nuvio/api-providers': '/collections/nuvio/getting-started/api-providers',
    '/collections/nuvio/provider-manifests': '/collections/nuvio/getting-started/provider-manifests',
  },
  vite: { plugins: [gifDevApi()] },
});
