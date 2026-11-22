import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Node's coverage report only lists files that something loaded, so a module with no tests
 * at all silently drops out of the percentage. Loading every module here keeps the report
 * honest: an untested file shows up with its real (low) coverage instead of not at all.
 * Importing must also be free of side effects (no DOM, network or storage at load time).
 */
// fileURLToPath, not `.pathname`: on Windows the latter is "/C:/...", which breaks join().
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRS = ['src/lib', 'src/scripts', 'worker', 'packages/ui/src/lib'];

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return /\.(ts|js)$/.test(e.name) &&
      !e.name.endsWith('.d.ts') &&
      e.name !== 'dev-plugin.js' &&
      // Reads Vite's import.meta.env, which only exists inside the Astro build.
      e.name !== 'shell.ts'
      ? [path]
      : [];
  });
}

/** Entry scripts register page listeners as soon as they load; a do-nothing document is enough. */
const stubs = ['document', 'window', 'addEventListener'] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();
const nothing = () => [];
const fakeDocument = {
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: nothing,
  documentElement: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
  body: {},
};

describe('every source module', () => {
  before(() => {
    for (const name of stubs) saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.assign(globalThis, {
      document: fakeDocument,
      window: globalThis,
      addEventListener() {},
    });
  });
  after(() => {
    for (const name of stubs) {
      const original = saved.get(name);
      if (original) Object.defineProperty(globalThis, name, original);
      else delete (globalThis as Record<string, unknown>)[name];
    }
  });
  for (const file of DIRS.flatMap(files)) {
    it(`loads without side effects: ${relative('.', file)}`, async () => {
      assert.ok(await import(pathToFileURL(join(ROOT, file)).href));
    });
  }
});
