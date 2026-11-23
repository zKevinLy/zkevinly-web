import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      'dist/',
      '**/.astro/',
      'node_modules/',
      // Local tool output: never lint generated files.
      '.wrangler/',
      '.lighthouseci/',
      'coverage/',
      'dist-ui/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    // Cloudflare Worker + Node-side config run outside the browser bundle.
    files: ['worker/**/*.js', 'server/**/*.mjs'],
    languageOptions: {
      globals: {
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        Headers: 'readonly',
        console: 'readonly',
        process: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
  {
    // Service worker scripts served as-is from public/ (not bundled).
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
      },
    },
  },
];
