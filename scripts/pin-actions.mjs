/* global process, console, URL */
/**
 * Pins every `uses: owner/repo@ref` in .github/workflows to a full commit SHA.
 *
 *   npm run pin-actions            # rewrite workflows in place
 *   npm run pin-actions -- --check # exit 1 if anything is unpinned
 *
 * Resolves refs with `git ls-remote` (no token needed), peels annotated tags to
 * the underlying commit, and writes the exact release as a trailing comment so
 * Dependabot can keep bumping it:
 *
 *   uses: actions/checkout@<40-hex-sha> # v4.2.2
 *
 * Already-pinned lines, local actions (./...) and docker:// refs are left alone.
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const USES = /^(\s*(?:-\s+)?uses:\s*)([\w.-]+\/[\w.-]+(?:\/[\w./-]+)?)@([^\s#]+)(\s*#.*)?$/;
const SHA = /^[0-9a-f]{40}$/;
const SKIP = (repo) => repo.startsWith('./') || repo.startsWith('docker:');

const cache = new Map();

function lsRemote(ownerRepo, pattern) {
  const out = execFileSync(
    'git',
    ['ls-remote', '--tags', `https://github.com/${ownerRepo}.git`, pattern],
    { encoding: 'utf8' },
  );
  const tags = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [sha, ref] = line.split('\t');
    const peeled = ref.endsWith('^{}');
    const name = ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '');
    // A peeled entry (^{}) is the commit an annotated tag points at: prefer it.
    if (peeled || !tags.has(name)) tags.set(name, sha);
  }
  return tags;
}

const semver = (t) => t.replace(/^v/, '').split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

export function resolve(ownerRepo, ref) {
  const key = `${ownerRepo}@${ref}`;
  if (cache.has(key)) return cache.get(key);
  const tags = lsRemote(ownerRepo, `refs/tags/${ref}*`);
  if (!tags.has(ref)) {
    throw new Error(`${key}: no such tag (branches are not pinned automatically)`);
  }
  const sha = tags.get(ref);
  let exact = ref;
  // A floating major tag (v4): find the exact release sitting on the same commit.
  if (/^v?\d+$/.test(ref)) {
    const same = [...tags].filter(([t, s]) => s === sha && /^v?\d+\.\d+\.\d+$/.test(t));
    if (same.length) exact = same.map(([t]) => t).sort(newer).at(-1);
  }
  const result = { sha, exact };
  cache.set(key, result);
  return result;
}

export function pinLine(line, resolver = resolve) {
  const m = USES.exec(line);
  if (!m || SKIP(m[2]) || SHA.test(m[3])) return line;
  const base = m[2].split('/').slice(0, 2).join('/');
  const { sha, exact } = resolver(base, m[3]);
  return `${m[1]}${m[2]}@${sha} # ${exact}`;
}

async function main() {
  const check = process.argv.includes('--check');
  let unpinned = 0;
  const files = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f)).sort();
  for (const file of files) {
    const path = WORKFLOWS + file;
    const text = await readFile(path, 'utf8');
    const lines = text.split('\n');
    const next = lines.map((line) => {
      if (!check) return pinLine(line);
      const m = USES.exec(line);
      if (m && !SKIP(m[2]) && !SHA.test(m[3])) {
        console.log(`${file}: ${line.trim()}`);
        unpinned++;
      }
      return line;
    });
    const out = next.join('\n');
    if (!check && out !== text) {
      await writeFile(path, out);
      console.log(`pinned ${file}`);
    }
  }
  if (check && unpinned) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
