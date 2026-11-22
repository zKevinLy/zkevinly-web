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

type Token = { tag: Tag } | { text: string };

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isLetter = (c: string | undefined) => c !== undefined && /[a-zA-Z]/.test(c);
const isNameChar = (c: string) => /[\w-]/.test(c);

/**
 * A small HTML scanner: one pass, no backtracking. It yields start tags (with parsed attributes)
 * and text. Comments, doctype/bogus comments, end tags, and the bodies of <script> and <style>
 * produce no text (the script/style start tags themselves are kept). Not a full HTML parser, but
 * it never re-scans its own output, so there is nothing left to "sanitize twice".
 */
function* scan(html: string): Generator<Token> {
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      yield { text: html.slice(i) };
      return;
    }
    if (lt > i) yield { text: html.slice(i, lt) };

    const next = html[lt + 1];
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      yield { text: ' ' };
    } else if (next === '!' || next === '?') {
      const end = html.indexOf('>', lt + 2);
      i = end === -1 ? n : end + 1;
      yield { text: ' ' };
    } else if (next === '/') {
      const end = html.indexOf('>', lt + 2);
      i = end === -1 ? n : end + 1;
      yield { text: ' ' };
    } else if (isLetter(next)) {
      let j = lt + 1;
      while (j < n && isNameChar(html[j])) j++;
      const name = html.slice(lt + 1, j).toLowerCase();
      const attrs: Record<string, string> = {};
      let selfClosed = false;
      let closed = false;
      while (j < n) {
        while (j < n && isSpace(html[j])) j++;
        if (html[j] === '/') {
          selfClosed = true;
          j++;
          continue;
        }
        if (j >= n) break;
        if (html[j] === '>') {
          j++;
          closed = true;
          break;
        }
        selfClosed = false;
        const nameStart = j;
        j++; // an attribute name is at least one character, even a stray "="
        while (j < n && !isSpace(html[j]) && !'=>/'.includes(html[j])) j++;
        const attr = html.slice(nameStart, j);
        while (j < n && isSpace(html[j])) j++;
        let value = '';
        if (html[j] === '=') {
          j++;
          while (j < n && isSpace(html[j])) j++;
          const q = html[j];
          if (q === '"' || q === "'") {
            const close = html.indexOf(q, j + 1);
            value = html.slice(j + 1, close === -1 ? n : close);
            j = close === -1 ? n : close + 1;
          } else {
            const valueStart = j;
            while (j < n && !isSpace(html[j]) && html[j] !== '>') j++;
            value = html.slice(valueStart, j);
          }
        }
        attrs[attr] = unescape(value);
      }
      if (!closed) return; // a tag cut off by the end of the input is dropped
      yield { tag: { name, attrs } };
      i = j;

      // Raw-text elements: skip their body up to the matching end tag (which is scanned normally).
      if ((name === 'script' || name === 'style') && !selfClosed) {
        let k = i;
        for (;;) {
          const close = html.indexOf('</', k);
          if (close === -1) {
            i = n;
            break;
          }
          const after = html[close + 2 + name.length];
          const matches = html.slice(close + 2, close + 2 + name.length).toLowerCase() === name;
          if (matches && (after === undefined || !isNameChar(after))) {
            i = close;
            break;
          }
          k = close + 2;
        }
      }
    } else {
      yield { text: '<' }; // a lone "<" is just text
      i = lt + 1;
    }
  }
}

/** A chunk of rendered HTML with small query helpers (no DOM needed). */
export class Html {
  readonly html: string;

  constructor(html: string) {
    this.html = html;
  }

  /** Every start tag with the given name (optionally filtered by attribute values). */
  tags(name: string, where: Record<string, string | RegExp> = {}): Tag[] {
    const found: Tag[] = [];
    for (const token of scan(this.html)) {
      if (!('tag' in token) || token.tag.name !== name) continue;
      const { attrs } = token.tag;
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
    let out = '';
    for (const token of scan(this.html)) out += 'text' in token ? token.text : ' ';
    return unescape(out.replace(/\s+/g, ' ').trim());
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
