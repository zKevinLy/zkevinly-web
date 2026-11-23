// Parses Cloudflare's `_headers` file so the container sends the same security headers as the Worker.
// Supports what public/_headers uses: path rules with `*` splats, `Name: value`, and `! Name` (drop).

/** @returns {{ test: RegExp, set: [string, string][], drop: string[] }[]} */
export function parseHeaders(text) {
  const rules = [];
  let rule = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      const source = raw
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      rule = { test: new RegExp(`^${source}$`), set: [], drop: [] };
      rules.push(rule);
    } else if (rule) {
      const line = raw.trim();
      if (line.startsWith('!')) rule.drop.push(line.slice(1).trim().toLowerCase());
      else {
        const i = line.indexOf(':');
        if (i > 0) rule.set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
      }
    }
  }
  return rules;
}

/** Headers for a URL path: matching rules apply in file order; `!` removes earlier values. */
export function headersFor(rules, pathname) {
  const out = new Map();
  for (const rule of rules) {
    if (!rule.test.test(pathname)) continue;
    for (const name of rule.drop) out.delete(name);
    for (const [name, value] of rule.set) {
      const key = name.toLowerCase();
      out.set(key, out.has(key) ? `${out.get(key)}, ${value}` : value);
    }
  }
  return out;
}
