import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expectedIndexCss } from '../scripts/sync.mjs';

// The "everything is tested and wired" rules. They need no build, so they run in every
// `npm test` and fail the moment someone adds a component or stylesheet without the rest.

const PKG = resolve(import.meta.dirname, '..');
const SRC = join(PKG, 'src');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');

const folders: [string, string][] = [
  ['base', join(SRC, 'components/base')],
  ['composite', join(SRC, 'components/composite')],
  ['layouts', join(SRC, 'layouts')],
];
const components = folders.flatMap(([dir, path]) =>
  readdirSync(path)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => ({ dir, name: f.replace(/\.astro$/, ''), file: join(path, f) })),
);

describe('every component is tested', () => {
  const testSource = read(PKG, 'tests/components.test.ts');

  it('finds the components', () => {
    assert.ok(components.length >= 20, `only found ${components.length}`);
  });

  it('has a fixture page for each (renders its variants)', () => {
    const missing = components
      .filter((c) => !existsSync(join(PKG, 'tests/fixture/src/pages', `${c.name}.astro`)))
      .map((c) => c.name);
    assert.deepEqual(missing, [], 'add tests/fixture/src/pages/<Name>.astro');
  });

  it('imports the component from the package in its fixture page', () => {
    const wrong = components
      .filter((c) => {
        const page = join(PKG, 'tests/fixture/src/pages', `${c.name}.astro`);
        return existsSync(page) && !read(page).includes(`@zkevinly/ui/${c.dir}/${c.name}.astro`);
      })
      .map((c) => c.name);
    assert.deepEqual(wrong, [], 'fixture pages must import via the public export path');
  });

  it('has a describe() in components.test.ts for each', () => {
    const missing = components
      .filter((c) => !testSource.includes(`describe('${c.name}'`))
      .map((c) => c.name);
    assert.deepEqual(missing, [], "add describe('<Name>', …) to tests/components.test.ts");
  });

  it('gives every describe() at least two assertions-worth of cases or a reason', () => {
    // Each component needs more than a smoke test: every fixture page has 2+ variants, except
    // Steps (one purpose) and Layout (a whole document: its variants are separate pages).
    const thin = components
      .filter((c) => {
        const page = join(PKG, 'tests/fixture/src/pages', `${c.name}.astro`);
        return existsSync(page) && (read(page).match(/<test-case /g) ?? []).length < 2;
      })
      .map((c) => c.name);
    assert.deepEqual(thin.sort(), ['Layout', 'Steps']);
  });

  it('has no stray describe() for a component that no longer exists', () => {
    const names = new Set(components.map((c) => c.name));
    const stray = [...testSource.matchAll(/^describe\('([A-Za-z]+)'/gm)]
      .map((m) => m[1])
      .filter((n) => !names.has(n));
    assert.deepEqual(stray, []);
  });
});

describe('styles are wired automatically', () => {
  it('index.css imports exactly the stylesheets on disk (run `npm run ui:sync`)', () => {
    assert.equal(read(SRC, 'styles/index.css'), expectedIndexCss());
  });

  it('puts tokens first, so every later file can use them', () => {
    const imports = read(SRC, 'styles/index.css').match(/@import '[^']+'/g) ?? [];
    assert.equal(imports[0], "@import './base/tokens.css'");
  });
});

/** Static class tokens in a component's markup (class="…" and string literals in class:list). */
function classTokens(source: string): string[] {
  const markup = source.split(/^---$/m).slice(2).join('---'); // drop the frontmatter
  const out = new Set<string>();
  for (const m of markup.matchAll(/\sclass="([^"{]*)"/g))
    m[1].split(/\s+/).forEach((t) => t && out.add(t));
  for (
    let i = markup.indexOf('class:list={');
    i !== -1;
    i = markup.indexOf('class:list={', i + 1)
  ) {
    let depth = 0;
    let j = i + 'class:list='.length;
    const start = j;
    for (; j < markup.length; j++) {
      if (markup[j] === '{') depth++;
      if (markup[j] === '}' && --depth === 0) break;
    }
    // array items and object keys only, so comparisons like `size === 'compact'` are ignored
    for (const s of markup.slice(start, j).matchAll(/'([a-z][a-z0-9_-]*)'(?=\s*[:,\]])/g))
      out.add(s[1]);
  }
  return [...out];
}

describe('components only use classes the package styles', () => {
  const css = ['base', 'layout', 'components']
    .flatMap((dir) => readdirSync(join(SRC, 'styles', dir)).map((f) => read(SRC, 'styles', dir, f)))
    .join('\n');
  // Hooks for scripts / markers that are intentionally unstyled.
  const unstyled = new Set(['related', 'copy-btn-text', 'workflow-node', 'is-optional']);

  for (const c of components) {
    it(c.name, () => {
      const missing = classTokens(read(c.file)).filter(
        (t) => !unstyled.has(t) && !new RegExp(`\\.${t}(?![\\w-])`).test(css),
      );
      assert.deepEqual(
        missing,
        [],
        `no CSS for these classes: add it to src/styles/components/*.css`,
      );
    });
  }
});
