// Tiny HTML query helpers for the component tests (no DOM needed, no Astro needed).

export interface Tag {
  name: string;
  attrs: Record<string, string>;
}

const unescape = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** HTML with comments and script/style bodies blanked, so text inside them is never read as tags. */
const markup = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2>)/g, '$1$3');

/** A chunk of rendered HTML with small query helpers (no DOM needed). */
export class Html {
  readonly html: string;

  constructor(html: string) {
    this.html = html;
  }

  /** Every start tag with the given name (optionally filtered by attribute values). */
  tags(name: string, where: Record<string, string | RegExp> = {}): Tag[] {
    const found: Tag[] = [];
    for (const m of markup(this.html).matchAll(TAG)) {
      if (m[1].toLowerCase() !== name) continue;
      const attrs: Record<string, string> = {};
      for (const a of m[2].matchAll(ATTR)) {
        attrs[a[1]] = unescape(a[2] ?? a[3] ?? a[4] ?? '');
      }
      const ok = Object.entries(where).every(([k, v]) =>
        typeof v === 'string' ? attrs[k] === v : v.test(attrs[k] ?? ''),
      );
      if (ok) found.push({ name, attrs });
    }
    return found;
  }

  /** The single tag matching, or fails the test with a useful message. */
  tag(name: string, where: Record<string, string | RegExp> = {}): Tag {
    const all = this.tags(name, where);
    if (all.length !== 1) {
      throw new Error(
        `expected exactly 1 <${name}> ${JSON.stringify(where)}, found ${all.length} in:\n${this.html}`,
      );
    }
    return all[0];
  }

  /** Does any <name> carry this class token? */
  hasClass(name: string, cls: string): boolean {
    return this.tags(name).some((t) => (t.attrs.class ?? '').split(/\s+/).includes(cls));
  }

  /** Visible text: tags removed, entities decoded, whitespace collapsed. */
  get text(): string {
    return unescape(
      this.html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<(?:"[^"]*"|'[^']*'|[^>"'])*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }
}

export class Page extends Html {
  /** One `<test-case id="…">` block from the fixture page. */
  case(id: string): Html {
    const m = new RegExp(`<test-case id="${id}">([\\s\\S]*?)</test-case>`).exec(this.html);
    if (!m) throw new Error(`no test case "${id}" in the fixture page`);
    return new Html(m[1]);
  }
}
