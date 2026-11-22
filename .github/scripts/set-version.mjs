// Writes release versions into every file that carries one, so the repo never disagrees with
// the tags CI creates. Idempotent: running it twice changes nothing the second time.
//
//   node .github/scripts/set-version.mjs --site 1.4.0 [--ui 0.3.1]
//
// Files updated (only when the value differs):
//   package.json                 "version"                       <- --site
//   package-lock.json            "version" and packages[""]      <- --site
//   packages/ui/package.json     "version"                       <- --ui
//   package-lock.json            packages["packages/ui"]         <- --ui
//
// Add a file here when something new starts carrying a version. (public/version.json is written
// at deploy time by the deploy job, not committed.)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * @param {string} label
 * @param {string} value
 */
function checkVersion(label, value) {
  if (!SEMVER.test(value))
    throw new Error(`--${label} must be a version like 1.2.3, got "${value}"`);
}

/**
 * Reads a JSON file, applies `edit`, and writes it back (2-space indent, trailing newline) if it changed.
 * @param {string} path
 * @param {(data: any) => void} edit
 * @returns {boolean} whether the file changed
 */
function updateJson(path, edit) {
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  edit(data);
  const next = `${JSON.stringify(data, null, 2)}\n`;
  if (next === raw) return false;
  writeFileSync(path, next);
  return true;
}

/**
 * Stamps versions under `root`. Returns the relative paths of the files that changed.
 * @param {string} root
 * @param {{ site?: string, ui?: string }} versions
 * @returns {string[]}
 */
export function stampVersions(root, { site, ui }) {
  if (site === undefined && ui === undefined)
    throw new Error('Nothing to do: pass --site and/or --ui');
  if (site !== undefined) checkVersion('site', site);
  if (ui !== undefined) checkVersion('ui', ui);

  /** @type {string[]} */
  const changed = [];
  /** @type {(rel: string, edit: (data: any) => void) => void} */
  const touch = (rel, edit) => {
    if (updateJson(join(root, rel), edit)) changed.push(rel);
  };

  if (site !== undefined) {
    touch('package.json', (pkg) => {
      pkg.version = site;
    });
  }
  if (ui !== undefined) {
    touch('packages/ui/package.json', (pkg) => {
      pkg.version = ui;
    });
  }
  touch('package-lock.json', (lock) => {
    if (site !== undefined) {
      lock.version = site;
      if (lock.packages?.['']) lock.packages[''].version = site;
    }
    if (ui !== undefined && lock.packages?.['packages/ui'])
      lock.packages['packages/ui'].version = ui;
  });

  return changed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  try {
    const changed = stampVersions(process.cwd(), { site: flag('site'), ui: flag('ui') });
    process.stdout.write(
      changed.length ? `Updated: ${changed.join(', ')}\n` : 'Versions already up to date.\n',
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
