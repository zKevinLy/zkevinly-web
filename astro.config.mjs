// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { gifDevApi } from './worker/dev-plugin.js';

export default defineConfig({
  site: 'https://zkevinly.com',
  integrations: [mdx()],
  vite: { plugins: [gifDevApi()] },
});
