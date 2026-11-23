import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// Keeps @zkevinly/ui free of business logic: it may only import from itself and its own
// dependencies, never from the app (src/, config, lib/*). Also checks the `exports` map.

const PKG = resolve('packages/ui');
const SRC = join(PKG, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(SRC).filter((f) => /\.(astro|ts)$/.test(f));

/** Every module specifier in import / export-from / dynamic import() statements (not `x.from('…')`). */
const SPECIFIER =
  /(?:\bimport\s+(?:[^;'"()]*?\s+from\s+)?|\bexport\s+[^;'"()]*?\s+from\s+|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
const specifiers = (code: string) => [...code.matchAll(SPECIFIER)].map((m) => m[1]);
const relativeImports = (code: string) => specifiers(code).filter((s) => s.startsWith('.'));

describe('@zkevinly/ui boundary', () => {
  it('finds the package sources', () => {
    assert.ok(files.length > 0);
  });

  it('never imports outside packages/ui/src', () => {
    const escapes: string[] = [];
    for (const file of files) {
      for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
        const target = resolve(dirname(file), spec);
        if (relative(SRC, target).startsWith('..')) {
          escapes.push(`${relative(PKG, file)} -> ${spec}`);
        }
      }
    }
    assert.deepEqual(escapes, []);
  });

  it('only imports packages it declares (peer/dependencies) or Astro built-ins', () => {
    const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
    const allowed = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
    const undeclared: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      for (const spec of specifiers(code).filter((x) => !x.startsWith('.'))) {
        const name = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        if (!allowed.has(name) && !name.startsWith('astro:'))
          undeclared.push(`${relative(PKG, file)} -> ${spec}`);
      }
    }
    assert.deepEqual(undeclared, []);
  });

  it('the app references package components instead of redefining them', () => {
    const names = new Set(
      ['base', 'composite'].flatMap((d) =>
        readdirSync(join(SRC, 'components', d)).map((f) => f.replace(/\.astro$/, '')),
      ),
    );
    const appFiles = walk(resolve('src')).filter((f) => f.endsWith('.astro'));
    const dupes = appFiles
      .map((f) => f.replace(/^.*\//, '').replace(/\.astro$/, ''))
      .filter((n) => names.has(n));
    assert.deepEqual(
      dupes,
      [],
      'a component with the package name exists in src/: use the package one',
    );

    // Hand-written copies of package markup (e.g. <div class="node">) belong in the package too.
    // (`tag` is left out: FilterBar reuses the pill style on a toggle <button>, which <Tags> can't render.)
    const owned = ['node', 'badge', 'btn', 'grid', 'tags', 'nav-link', 'cmd'];
    const copies = appFiles.filter((f) =>
      new RegExp(`class="(?:${owned.join('|')})[ "]`).test(readFileSync(f, 'utf8')),
    );
    assert.deepEqual(
      copies.map((f) => relative(resolve('.'), f)),
      [],
    );
  });

  it('every `exports` target exists', () => {
    const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
    const missing: string[] = [];
    for (const [key, target] of Object.entries<string>(pkg.exports)) {
      if (key.includes('*')) {
        const dir = join(PKG, dirname(target));
        if (!existsSync(dir) || readdirSync(dir).length === 0) missing.push(`${key} -> ${target}`);
      } else if (!existsSync(join(PKG, target))) {
        missing.push(`${key} -> ${target}`);
      }
    }
    assert.deepEqual(missing, []);
  });
});
