import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'astro';
import { Page } from './html';

export { Html, Page, type Tag } from './html';

// Renders the real components through Astro's compiler: builds tests/fixture (one page per
// component, each with several <test-case id="…"> variants) once, then parses the HTML.

const FIXTURE = resolve(import.meta.dirname, '../fixture');

export async function buildFixture() {
  const outDir = await mkdtemp(join(tmpdir(), 'ui-fixture-'));
  await build({
    root: FIXTURE,
    configFile: false,
    outDir,
    logLevel: 'error',
    // Astro finds `.astro` packages through the project's own package.json; the fixture has none,
    // so name them (otherwise Vite would externalise them and Node can't load `.astro` files).
    vite: { ssr: { noExternal: ['@zkevinly/ui', '@lucide/astro'] } },
  });
  return {
    async page(name: string): Promise<Page> {
      return new Page(await readFile(join(outDir, name, 'index.html'), 'utf8'));
    },
    cleanup: () => rm(outDir, { recursive: true, force: true }),
  };
}
