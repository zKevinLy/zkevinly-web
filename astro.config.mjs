// @ts-check
import { defineConfig } from 'astro/config';
import { gifDevApi } from './worker/dev-plugin.js';

export default defineConfig({
  site: 'https://zkevinly.com',
  // The invoice generator became the multi-type PDF generator; keep the old link working.
  redirects: { '/toolkit/invoice': '/toolkit/pdf?type=invoice' },
  vite: { plugins: [gifDevApi()] },
});
