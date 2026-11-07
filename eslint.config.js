import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    // Cloudflare Worker + Node-side config run outside the browser bundle.
    files: ['worker/**/*.js'],
    languageOptions: {
      globals: {
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
];
