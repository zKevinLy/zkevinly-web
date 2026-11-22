import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stampVersions } from '../../.github/scripts/set-version.mjs';

// The release job stamps versions into the repo's files with this script.

let dir: string;
const write = (rel: string, data: unknown) =>
  writeFileSync(join(dir, rel), `${JSON.stringify(data, null, 2)}\n`);
const read = (rel: string) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'set-version-'));
  mkdirSync(join(dir, 'packages/ui'), { recursive: true });
  write('package.json', { name: 'site', version: '0.1.0', private: true });
  write('packages/ui/package.json', { name: '@zkevinly/ui', version: '0.1.0' });
  write('package-lock.json', {
    name: 'site',
    version: '0.1.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'site', version: '0.1.0' },
      'packages/ui': { name: '@zkevinly/ui', version: '0.1.0' },
      'node_modules/@zkevinly/ui': { resolved: 'packages/ui', link: true },
    },
  });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('stampVersions', () => {
  it('stamps the site version into package.json and the lockfile root', () => {
    const changed = stampVersions(dir, { site: '1.4.0' });
    assert.deepEqual(changed, ['package.json', 'package-lock.json']);
    assert.equal(read('package.json').version, '1.4.0');
    assert.equal(read('package-lock.json').version, '1.4.0');
    assert.equal(read('package-lock.json').packages[''].version, '1.4.0');
    assert.equal(read('packages/ui/package.json').version, '0.1.0', 'UI untouched');
    assert.equal(read('package-lock.json').packages['packages/ui'].version, '0.1.0');
  });

  it('stamps the UI version into its package.json and its lockfile entry', () => {
    const changed = stampVersions(dir, { site: '1.4.0', ui: '0.3.1' });
    assert.deepEqual(changed.sort(), [
      'package-lock.json',
      'package.json',
      'packages/ui/package.json',
    ]);
    assert.equal(read('packages/ui/package.json').version, '0.3.1');
    assert.equal(read('package-lock.json').packages['packages/ui'].version, '0.3.1');
    assert.equal(read('package-lock.json').packages[''].version, '1.4.0');
  });

  it('is idempotent: a second run changes nothing', () => {
    stampVersions(dir, { site: '1.4.0', ui: '0.3.1' });
    assert.deepEqual(stampVersions(dir, { site: '1.4.0', ui: '0.3.1' }), []);
  });

  it('keeps everything else in the files as it was, with a trailing newline', () => {
    stampVersions(dir, { site: '2.0.0' });
    const raw = readFileSync(join(dir, 'package.json'), 'utf8');
    assert.ok(raw.endsWith('}\n'));
    assert.deepEqual(JSON.parse(raw), { name: 'site', version: '2.0.0', private: true });
    assert.equal(read('package-lock.json').lockfileVersion, 3);
  });

  it('accepts pre-release versions', () => {
    stampVersions(dir, { site: '1.0.0-beta.1' });
    assert.equal(read('package.json').version, '1.0.0-beta.1');
  });

  it('rejects anything that is not a version, and an empty call', () => {
    assert.throws(() => stampVersions(dir, { site: 'v1.2.3' }), /--site must be a version/);
    assert.throws(() => stampVersions(dir, { ui: '1.2' }), /--ui must be a version/);
    assert.throws(() => stampVersions(dir, {}), /Nothing to do/);
    assert.equal(read('package.json').version, '0.1.0', 'nothing written on error');
  });
});
