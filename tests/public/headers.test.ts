import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Cloudflare `_headers` format: a path line, then indented `Name: value` / `! Name` lines. */
function parse(text: string) {
  const rules = new Map<string, { set: Map<string, string[]>; unset: Set<string> }>();
  let current: { set: Map<string, string[]>; unset: Set<string> } | null = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!raw.startsWith(' ')) {
      current = { set: new Map(), unset: new Set() };
      rules.set(raw.trim(), current);
    } else if (current) {
      const line = raw.trim();
      if (line.startsWith('!')) current.unset.add(line.slice(1).trim().toLowerCase());
      else {
        const i = line.indexOf(':');
        const name = line.slice(0, i).trim().toLowerCase();
        current.set.set(name, [...(current.set.get(name) ?? []), line.slice(i + 1).trim()]);
      }
    }
  }
  return rules;
}

const rules = parse(readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8'));
const site = rules.get('/*')!;
const csp = (rule: typeof site) => rule.set.get('content-security-policy')?.[0] ?? '';

describe('_headers', () => {
  it('every site page is non-framable, non-sniffable and HTTPS-only', () => {
    assert.equal(site.set.get('x-content-type-options')?.[0], 'nosniff');
    assert.equal(site.set.get('x-frame-options')?.[0], 'DENY');
    assert.match(site.set.get('strict-transport-security')![0], /max-age=\d{7,}/);
    assert.match(csp(site), /frame-ancestors 'none'/);
    assert.match(csp(site), /object-src 'none'/);
    assert.match(csp(site), /base-uri 'self'/);
  });

  it('site pages only run scripts from this origin', () => {
    const script = /script-src ([^;]+)/.exec(csp(site))?.[1] ?? '';
    assert.match(script, /'self'/);
    assert.doesNotMatch(script, /https?:|\*/, 'no remote script hosts, no wildcards');
  });

  it('hashed build output is cached for a year, immutable', () => {
    const cache = rules.get('/_astro/*')?.set.get('cache-control')?.[0] ?? '';
    assert.match(cache, /max-age=31536000/);
    assert.match(cache, /immutable/);
  });

  it('the toolkit replaces (not stacks) the site policy, and talks to no other origin', () => {
    for (const path of ['/toolkit', '/toolkit/*']) {
      const rule = rules.get(path)!;
      assert.ok(rule.unset.has('content-security-policy'), `${path} drops the site CSP first`);
      assert.ok(rule.unset.has('referrer-policy'), `${path} drops the site Referrer-Policy first`);
      assert.equal(rule.set.get('content-security-policy')!.length, 1);
      assert.match(csp(rule), /default-src 'self'/);
      assert.match(csp(rule), /connect-src 'self'/);
      assert.match(csp(rule), /form-action 'none'/);
      assert.equal(rule.set.get('referrer-policy')![0], 'no-referrer');
    }
  });

  it('no header is set twice on the same rule', () => {
    for (const [path, rule] of rules) {
      for (const [name, values] of rule.set) assert.equal(values.length, 1, `${path}: ${name}`);
    }
  });
});
