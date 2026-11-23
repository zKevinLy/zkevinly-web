import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './helpers/render';
import type { Html } from './helpers/render';

// Renders every component through Astro (see helpers/render.ts and fixture/) and checks the
// markup. One describe() per component, named exactly like the component: components.guard.test.ts
// fails if a component has no fixture page or no describe() here.

let fixture: Awaited<ReturnType<typeof buildFixture>>;
before(
  async () => {
    fixture = await buildFixture();
  },
  { timeout: 180_000 },
);
after(() => fixture?.cleanup());

const page = (name: string) => fixture.page(name);
const has = (h: Html, name: string, cls: string) => h.hasClass(name, cls);
const attrs = (h: Html, name: string, where = {}) => h.tag(name, where).attrs;

describe('Avatar', () => {
  it('defaults to the site favicon at 32px with empty alt', async () => {
    const a = attrs((await page('Avatar')).case('default'), 'img');
    assert.equal(a.class, 'avatar');
    assert.equal(a.src, '/favicon.svg');
    assert.equal(a.width, '32');
    assert.equal(a.height, '32');
    assert.equal(a.alt, '');
  });
  it('takes src, size and alt', async () => {
    const a = attrs((await page('Avatar')).case('custom'), 'img');
    assert.deepEqual([a.src, a.width, a.height, a.alt], ['/me.png', '64', '64', 'Me']);
  });
});

describe('Background', () => {
  it('renders nothing without an image', async () => {
    assert.equal((await page('Background')).case('none').tags('div').length, 0);
  });
  it('is a hidden fixed layer carrying the image', async () => {
    const a = attrs((await page('Background')).case('plain'), 'div');
    assert.equal(a.class, 'bg-layer');
    assert.equal(a['aria-hidden'], 'true');
    assert.equal(a.style, '--bg-image:url("https://example.com/wall.jpg")');
  });
  it('passes blur, saturate, brightness and opacity as custom properties', async () => {
    const a = attrs((await page('Background')).case('tuned'), 'div');
    assert.equal(
      a.style,
      '--bg-image:url("/wall.jpg");--bg-blur:12px;--bg-saturate:50%;--bg-brightness:75%;--bg-opacity:0.4',
    );
  });
});

describe('Badge', () => {
  it('is a span without href', async () => {
    const c = (await page('Badge')).case('span');
    assert.equal(c.tags('a').length, 0);
    assert.equal(attrs(c, 'span').class, 'badge');
    assert.equal(c.text, 'v1.0');
  });
  it('is a link with href', async () => {
    const a = attrs((await page('Badge')).case('link'), 'a');
    assert.equal(a.class, 'badge badge-link');
    assert.equal(a.href, '/rel');
    assert.equal(a.target, undefined);
  });
  it('opens external links safely', async () => {
    const a = attrs((await page('Badge')).case('external'), 'a');
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  });
  it('can be forced to an <a> before an href exists, forwarding attributes', async () => {
    const a = attrs((await page('Badge')).case('forced-link'), 'a');
    assert.equal(a['data-role'], 'release');
    assert.equal(a.href, undefined);
  });
  it('forwards extra attributes on the span', async () => {
    const a = attrs((await page('Badge')).case('attrs'), 'span');
    assert.equal(a['data-role'], 'visibility');
    assert.equal(a.title, 'Public');
  });
});

describe('Breadcrumb', () => {
  it('links every item but the last, which is the current page', async () => {
    const c = (await page('Breadcrumb')).case('trail');
    assert.equal(attrs(c, 'nav')['aria-label'], 'Breadcrumb');
    assert.deepEqual(
      c.tags('a').map((t) => t.attrs.href),
      ['/', '/guides'],
    );
    assert.equal(attrs(c, 'span', { 'aria-current': 'page' }).class, undefined);
    assert.equal(c.text, 'Home / Guides / Setup');
  });
  it('renders nothing when empty', async () => {
    assert.equal((await page('Breadcrumb')).case('empty').tags('nav').length, 0);
  });
});

describe('Button', () => {
  it('is a link styled as a button', async () => {
    const c = (await page('Button')).case('internal');
    const a = attrs(c, 'a');
    assert.equal(a.class, 'btn');
    assert.equal(a.href, '/about');
    assert.equal(a.target, undefined);
    assert.equal(c.text, 'About');
  });
  it('opens external links safely', async () => {
    const a = attrs((await page('Button')).case('external'), 'a');
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
  });
});

describe('Button (action mode)', () => {
  it('without href is a real <button type="button"> and forwards attributes', async () => {
    const c = (await page('Button')).case('action');
    assert.equal(c.tags('a').length, 0);
    const b = attrs(c, 'button');
    assert.equal(b.type, 'button');
    assert.equal(b.class, 'btn wide');
    assert.equal(b['data-action'], 'save');
    assert.equal(b['aria-pressed'], 'false');
    assert.equal(c.text, 'Save');
  });
  it('primary adds the accent variant in both modes; hidden is forwarded', async () => {
    const p = await page('Button');
    const b = attrs(p.case('primary'), 'button');
    assert.equal(b.class, 'btn btn-primary');
    assert.ok('hidden' in b);
    assert.equal(attrs(p.case('primary-link'), 'a').class, 'btn btn-primary');
  });
});

describe('Button (icon variant)', () => {
  it('is a labelled link with a tooltip and nav hook', async () => {
    const a = attrs((await page('Button')).case('icon-link'), 'a');
    assert.equal(a.id, 'home-btn');
    assert.equal(a.class, 'btn btn-icon');
    assert.equal(a.href, '/');
    assert.equal(a['aria-label'], 'Home');
    assert.equal(a['data-tooltip'], 'Home');
    assert.equal(a['data-nav-href'], '/');
    assert.equal(a['aria-current'], undefined);
  });
  it('is a <button> without href, with its own tooltip', async () => {
    const c = (await page('Button')).case('icon-button');
    assert.equal(c.tags('a').length, 0);
    const b = attrs(c, 'button');
    assert.equal(b.type, 'button');
    assert.equal(b['aria-label'], 'Theme');
    assert.equal(b['data-tooltip'], 'Switch theme');
  });
  it('marks the current page and supports a small size', async () => {
    const p = await page('Button');
    assert.equal(attrs(p.case('icon-current'), 'a')['aria-current'], 'page');
    const s = attrs(p.case('icon-small'), 'button');
    assert.equal(s.class, 'btn btn-icon btn-sm');
    assert.equal(s['data-reorder-dir'], '-1');
  });
});

describe('Button (copy)', () => {
  it('copies its text, with a default label and aria-label', async () => {
    const c = (await page('Button')).case('copy');
    const b = attrs(c, 'button');
    assert.equal(b.type, 'button');
    assert.equal(b.class, 'btn');
    assert.equal(b['data-copy'], 'npm i');
    assert.equal(b['data-copy-label'], 'Copy');
    assert.equal(b['aria-label'], 'Copy: npm i');
    assert.equal(c.tags('svg').length, 2, 'copy + done icons');
    assert.equal(c.text, 'Copy');
  });
  it('takes a variant, label, aria-label and extra class; text is decoded', async () => {
    const b = attrs((await page('Button')).case('copy-custom'), 'button');
    assert.equal(b['data-copy'], 'a && b');
    assert.equal(b['data-copy-label'], 'Grab');
    assert.equal(b['aria-label'], 'Copy the script');
    assert.deepEqual(b.class.split(' '), ['btn', 'btn-segment', 'extra']);
  });
  it('ships its click handler script with the page', async () => {
    assert.ok((await page('Button')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('DragHandle', () => {
  it('is a hidden button labelled for the screen reader', async () => {
    const b = attrs((await page('DragHandle')).case('card'), 'button');
    assert.equal(b.type, 'button');
    assert.equal(b.class, 'reorder-handle');
    assert.ok('data-reorder-handle' in b);
    assert.ok('hidden' in b);
    assert.equal(b['aria-label'], 'Move Plexio: drag, or use the arrow keys');
  });
  it('has a section variant', async () => {
    const b = attrs((await page('DragHandle')).case('section'), 'button');
    assert.equal(b.class, 'reorder-handle reorder-handle-section');
  });
});

describe('MoveButtons', () => {
  it('moves a card earlier or later', async () => {
    const c = (await page('MoveButtons')).case('card');
    assert.ok('data-reorder-move' in attrs(c, 'div'));
    assert.equal(c.tags('button').length, 2);
    assert.ok(c.html.includes('Move Plexio earlier'));
    assert.ok(c.html.includes('Move Plexio later'));
    assert.ok(c.html.includes('btn-icon'));
  });
  it('moves a section up, down and between columns', async () => {
    const c = (await page('MoveButtons')).case('section');
    assert.equal(c.tags('button').length, 4);
    assert.ok(has(c, 'div', 'reorder-move-section'));
    assert.ok(c.html.includes('Move Media section to the next column'));
  });
});

describe('ReorderColumns', () => {
  it('puts its content in the first column and adds empty ones', async () => {
    const c = (await page('ReorderColumns')).case('content');
    assert.ok('data-reorder-groups' in attrs(c, 'div', { class: 'reorder-columns' }));
    assert.ok(c.tags('div', { class: 'reorder-col' }).length >= 2);
    assert.equal(c.tags('p').length, 1);
  });
  it('renders the columns with no content', async () => {
    const c = (await page('ReorderColumns')).case('empty');
    assert.equal(c.tags('p').length, 0);
    assert.ok(c.tags('div', { class: 'reorder-col' }).length >= 2);
  });
});

describe('ViewInit', () => {
  it('applies the saved view before first paint', async () => {
    const c = (await page('ViewInit')).case('one');
    assert.ok(c.html.includes('ui:view'));
    assert.ok(c.html.includes('astro:before-swap'));
  });
  it('can be rendered more than once', async () => {
    assert.ok((await page('ViewInit')).case('two').html.includes('ui:view'));
  });
});

describe('ReorderToolbar', () => {
  it('has the view, column, reorder and reset controls', async () => {
    const c = (await page('ReorderToolbar')).case('default');
    assert.ok(c.html.includes('data-reorder-view="grid"'));
    assert.ok(c.html.includes('data-reorder-view="list"'));
    assert.ok(c.html.includes('data-reorder-edit'));
    assert.ok(c.html.includes('data-reorder-reset'));
    assert.ok(c.tags('button').length > 4);
  });
  it('uses icon buttons with tooltips and a status line', async () => {
    const c = (await page('ReorderToolbar')).case('again');
    assert.ok(c.html.includes('btn btn-icon'));
    assert.ok(c.html.includes('data-tooltip="Reset to the config order"'));
    assert.ok('data-reorder-status' in attrs(c, 'p'));
  });
});

describe('Dashboard', () => {
  it('is the page scope with a toolbar and columns', async () => {
    const c = (await page('Dashboard')).case('plain');
    const scope = attrs(c, 'div', { 'data-reorder-scope': 'home' });
    assert.ok('data-filter-scope' in scope);
    assert.ok(c.html.includes('data-reorder-edit'));
    assert.ok(c.html.includes('reorder-columns'));
    assert.ok(!c.html.includes('data-filter-sort'));
  });
  it('adds the filter bar when given a filter model', async () => {
    const c = (await page('Dashboard')).case('filtered');
    assert.ok(c.html.includes('data-reorder-scope="apps"'));
    assert.ok(c.html.includes('data-filter-sort'));
  });
});

describe('DashboardGroup', () => {
  it('is one reorderable titled section with a handle', async () => {
    const c = (await page('DashboardGroup')).case('plain');
    const g = attrs(c, 'div', { 'data-reorder-group': 'Media' });
    assert.equal(g['data-reorder-index'], '0');
    assert.ok(c.html.includes('reorder-handle-section'));
    assert.ok(c.html.includes('Move Media section: drag'));
    assert.equal(c.tags('p').length, 1);
  });
  it('shows a note and can hide itself when filtered empty', async () => {
    const c = (await page('DashboardGroup')).case('filtered');
    assert.equal(attrs(c, 'div', { 'data-reorder-group': 'Tools' })['data-reorder-index'], '2');
    assert.ok(c.text.includes('Handy'));
    assert.ok(c.html.includes('data-filter-group'));
  });
});

describe('Figure', () => {
  it('renders a lazy image with a caption', async () => {
    const c = (await page('Figure')).case('captioned');
    const img = attrs(c, 'img');
    assert.deepEqual([img.src, img.alt, img.loading], ['/a.png', 'An image', 'lazy']);
    assert.equal(c.tags('figure')[0].attrs.class, 'figure');
    assert.equal(c.text, 'Fig 1');
  });
  it('omits the caption when not given', async () => {
    assert.equal((await page('Figure')).case('plain').tags('figcaption').length, 0);
  });
});

describe('Freshness', () => {
  it('shows relative time, freshness state and an exact tooltip', async () => {
    const c = (await page('Freshness')).case('dated');
    const s = attrs(c, 'span', { 'data-role': 'updated' });
    assert.equal(s.class, 'updated');
    assert.equal(s['data-fresh'], 'cold');
    assert.equal(s.hidden, undefined);
    const t = attrs(c, 'time');
    assert.equal(t.datetime, '2020-01-01T00:00:00Z');
    assert.equal(t.title, 'Wed, 01 Jan 2020 00:00:00 GMT');
    assert.ok('data-relative' in t);
    assert.match(c.text, /^Updated \d+ years ago$/);
  });
  it('takes a label', async () => {
    assert.match((await page('Freshness')).case('labelled').text, /^Pushed /);
  });
  it('renders hidden, ready to be filled in, without a date', async () => {
    const c = (await page('Freshness')).case('undated');
    const s = attrs(c, 'span', { 'data-role': 'updated' });
    assert.ok('hidden' in s);
    assert.equal(s['data-fresh'], undefined);
    assert.equal(attrs(c, 'time').datetime, undefined);
  });
  it('ships the refresh script with the page', async () => {
    assert.ok((await page('Freshness')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('Grid', () => {
  it('wraps its slot', async () => {
    const c = (await page('Grid')).case('default');
    assert.equal(attrs(c, 'div').class, 'grid');
    assert.equal(c.tags('p').length, 2);
  });
  it('can be tight', async () => {
    assert.equal(attrs((await page('Grid')).case('tight'), 'div').class, 'grid grid-tight');
  });
});

describe('NavLink', () => {
  it('links and tracks its href for active-state scripts', async () => {
    const c = (await page('NavLink')).case('plain');
    const a = attrs(c, 'a');
    assert.deepEqual([a.class, a.href, a['data-nav-href']], ['nav-link', '/projects', '/projects']);
    assert.equal(a['aria-current'], undefined);
    assert.equal(c.text, 'Projects');
  });
  it('marks the current page', async () => {
    assert.equal(attrs((await page('NavLink')).case('current'), 'a')['aria-current'], 'page');
  });
});

describe('Node', () => {
  it('renders a title with a slug anchor and a description', async () => {
    const c = (await page('Node')).case('plain');
    const h = attrs(c, 'h3');
    assert.equal(h.class, 'node-title');
    assert.equal(h.id, 'node-hello-world');
    assert.equal(c.tags('p', { class: 'node-desc' }).length, 1);
    assert.ok(c.text.includes('Hello World!'));
    assert.ok(c.text.includes('A card'));
    assert.ok(!has(c, 'article', 'node-interactive'));
    assert.equal(c.tags('a').length, 0);
    assert.equal(c.tags('svg').length, 0);
  });
  it('is clickable with a chevron for internal links', async () => {
    const c = (await page('Node')).case('internal');
    assert.ok(has(c, 'article', 'node-interactive'));
    const a = attrs(c, 'a', { class: 'node-link' });
    assert.equal(a.href, '/docs');
    assert.equal(a.target, undefined);
    assert.equal(a['aria-label'], undefined);
    assert.equal(c.tags('svg').length, 1);
  });
  it('opens external links safely and says so', async () => {
    const a = attrs((await page('Node')).case('external'), 'a', { class: 'node-link' });
    assert.equal(a.target, '_blank');
    assert.equal(a.rel, 'noopener noreferrer');
    assert.equal(a['aria-label'], 'Repo (opens in a new tab)');
  });
  it('selectable + href: the title is not a link; only the icon opens it', async () => {
    const c = (await page('Node')).case('selectable');
    assert.ok(has(c, 'article', 'node-selectable'));
    assert.equal(c.tags('a', { class: 'node-link' }).length, 0);
    const open = attrs(c, 'a', { class: 'node-open' });
    assert.equal(open.href, 'https://example.com/app');
    assert.equal(open['aria-label'], 'Open App (opens in a new tab)');
    const box = attrs(c, 'input', { type: 'checkbox' });
    assert.equal(box['data-check'], 'app-1');
    assert.equal(box.autocomplete, 'off');
    assert.ok(c.text.includes('Mark as done: App'));
  });
  it('selectable without href has a checkbox only, with a custom verb', async () => {
    const c = (await page('Node')).case('selectable-label');
    assert.ok(has(c, 'article', 'node-selectable'));
    assert.equal(c.tags('a').length, 0);
    assert.ok(c.text.includes('Include: App'));
  });
  it('shows number, label and badges in the aside', async () => {
    const c = (await page('Node')).case('aside');
    assert.equal(c.tags('span', { class: 'node-number' }).length, 1);
    assert.ok(c.text.includes('01'));
    assert.ok(c.text.includes('Official'));
    assert.equal(c.tags('span', { class: 'node-badge' }).length, 2);
    assert.ok('data-pagefind-ignore' in attrs(c, 'span', { class: 'node-aside' }));
  });
  it('lists secondary links, external ones safely', async () => {
    const c = (await page('Node')).case('links');
    assert.equal(c.tags('li').length, 2);
    const [inside, outside] = c.tags('a', { class: 'node-action' });
    assert.equal(inside.attrs.target, undefined);
    assert.equal(outside.attrs.target, '_blank');
    assert.equal(outside.attrs.rel, 'noopener noreferrer');
  });
  it('supports heading level, size, searchable, class and attributes', async () => {
    const c = (await page('Node')).case('variants');
    assert.equal(c.tags('h3').length, 0);
    assert.equal(attrs(c, 'h2').class, 'node-title');
    const a = attrs(c, 'article');
    const tokens = a.class.split(' ');
    for (const t of ['node', 'node-compact', 'extra']) assert.ok(tokens.includes(t), t);
    assert.equal(a['data-reveal'], undefined);
    assert.ok('data-search-item' in a);
    assert.equal(a['data-x'], '1');
  });
  it('renders the default slot and a foot slot after it', async () => {
    const c = (await page('Node')).case('slots');
    assert.ok(c.html.indexOf('body') !== -1 && c.html.indexOf('body') < c.html.indexOf('foot'));
  });
  it('gives no anchor when the title has no letters or digits', async () => {
    assert.equal(attrs((await page('Node')).case('no-slug'), 'h3').id, undefined);
  });
  it('shows a Simple Icons glyph inline, before the title, decorative and ignored by search', async () => {
    const c = (await page('Node')).case('icon-glyph');
    const glyph = attrs(c, 'svg', { class: 'node-icon' });
    assert.equal(glyph['aria-hidden'], 'true');
    assert.equal(glyph.fill, 'currentColor');
    assert.ok('data-pagefind-ignore' in glyph);
    assert.match(c.tag('path').attrs.d, /^[Mm]/);
    // inside the title, ahead of its text
    assert.ok(c.html.indexOf('node-icon') < c.html.indexOf('Repo'));
    assert.equal(c.tags('img').length, 0);
  });
  it('maps a bare file name to Dashboard Icons, lower-cased, as an empty-alt image', async () => {
    const img = attrs((await page('Node')).case('icon-dashboard'), 'img', { class: 'node-icon' });
    assert.equal(
      img.src,
      'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/jellyfin.svg',
    );
    assert.equal(img.alt, '');
    assert.deepEqual([img.width, img.height, img.loading], ['24', '24', 'lazy']);
  });
  it('uses site paths and image URLs as they are', async () => {
    const p = await page('Node');
    assert.equal(attrs(p.case('icon-image'), 'img').src, '/logo.png');
    assert.equal(attrs(p.case('icon-url'), 'img').src, 'https://example.com/i.webp');
  });
  it('renders no icon for a blank value, and none by default', async () => {
    const p = await page('Node');
    assert.equal(
      p.case('no-icon-blank').tags('img').length + p.case('no-icon-blank').tags('svg').length,
      0,
    );
    assert.equal(p.case('plain').tags('img').length, 0);
  });
  it('adds a pending status dot to the aside when `ping` is set', async () => {
    const c = (await page('Node')).case('ping');
    const ping = attrs(c, 'span', { class: 'node-ping' });
    assert.equal(ping['data-state'], 'pending');
    assert.equal(ping.role, 'img');
    assert.equal(ping['aria-label'], 'Status: checking');
    assert.equal(c.tags('span', { class: 'node-ping-dot' }).length, 1);
    assert.ok('hidden' in attrs(c, 'span', { class: 'node-ping-text' }));
    // the cluster exists even though there is no badge, label, link or check box
    assert.ok('data-pagefind-ignore' in attrs(c, 'span', { class: 'node-aside' }));
  });
  it('puts the ping first in the aside and passes data attributes to the article', async () => {
    const c = (await page('Node')).case('ping-aside');
    assert.ok(c.html.indexOf('node-ping') < c.html.indexOf('node-label'));
    assert.equal(attrs(c, 'article')['data-ping-url'], 'https://example.com/');
  });
  it('has no ping dot without `ping`', async () => {
    assert.equal((await page('Node')).case('plain').tags('span', { class: 'node-ping' }).length, 0);
  });
});

describe('PageHeader', () => {
  it('renders the title and lead', async () => {
    const c = (await page('PageHeader')).case('lead');
    assert.equal(c.tags('h1', { class: 'page-title' }).length, 1);
    assert.equal(attrs(c, 'h1')['data-reveal'], undefined);
    assert.equal(c.text, 'Title Lead text');
    assert.ok(!has(c, 'header', 'topic-head'));
  });
  it('accepts a rich lead through the slot', async () => {
    const c = (await page('PageHeader')).case('slot');
    assert.equal(c.tags('em').length, 1);
    assert.equal(c.text, 'T2 rich lead');
  });
  it('can add topic spacing', async () => {
    assert.ok(has((await page('PageHeader')).case('spaced'), 'header', 'topic-head'));
  });
});

describe('Prose', () => {
  it('is a paragraph', async () => {
    const c = (await page('Prose')).case('default');
    const p = attrs(c, 'p');
    assert.equal(p.class, 'prose');
    assert.equal(p['data-reveal'], undefined);
    assert.equal(c.text, 'Some text');
  });
  it('accepts inline markup through the slot', async () => {
    const c = (await page('Prose')).case('inline');
    assert.equal(c.tags('em').length, 1);
    assert.equal(c.text, 'Some rich text');
  });
});

describe('Section', () => {
  it('renders title, note, slot, class and filter-group hook', async () => {
    const c = (await page('Section')).case('full');
    const s = attrs(c, 'section');
    assert.equal(s.class, 'mine');
    assert.equal(s['data-reveal'], undefined, 'no entrance animation hook');
    assert.ok('data-filter-group' in s);
    assert.equal(c.tags('h2', { class: 'section-title' }).length, 1);
    assert.equal(c.tags('p', { class: 'section-note' }).length, 1);
    assert.equal(c.text, 'Title A note in');
  });
  it('omits optional parts', async () => {
    const c = (await page('Section')).case('bare');
    const s = attrs(c, 'section');
    assert.equal(s['data-reveal'], undefined);
    assert.equal(s['data-filter-group'], undefined);
    assert.equal(c.tags('h2').length, 0);
    assert.equal(c.tags('p', { class: 'section-note' }).length, 0);
  });
});

describe('Select', () => {
  it('is a labelled native select with the chosen option selected', async () => {
    const c = (await page('Select')).case('basic');
    assert.equal(attrs(c, 'label').class, 'select-field');
    assert.equal(c.tags('span', { class: 'select-label' }).length, 1);
    const s = attrs(c, 'select');
    assert.equal(s.class, 'select');
    assert.equal(s.name, 'letter');
    const opts = c.tags('option');
    assert.deepEqual(
      opts.map((o) => o.attrs.value),
      ['a', 'b'],
    );
    assert.ok(!('selected' in opts[0].attrs));
    assert.ok('selected' in opts[1].attrs);
    assert.ok(c.text.includes('Letter') && c.text.includes('Alpha') && c.text.includes('Beta'));
  });
  it('can hide its label (screen readers only), be small and forward attributes', async () => {
    const c = (await page('Select')).case('small');
    assert.equal(c.tags('span', { class: 'sr-only' }).length, 1);
    assert.equal(c.tags('span', { class: 'select-label' }).length, 0);
    const s = attrs(c, 'select');
    assert.ok(s.class.split(' ').includes('select--sm'));
    assert.ok('data-sort' in s);
  });
});

describe('Steps', () => {
  it('is an ordered list', async () => {
    const c = (await page('Steps')).case('three');
    assert.equal(attrs(c, 'ol').class, 'steps');
    assert.equal(c.tags('li').length, 3);
    assert.equal(c.text, 'One Two Three');
  });
});

describe('Tags', () => {
  it('renders one pill per tag', async () => {
    const c = (await page('Tags')).case('some');
    assert.equal(attrs(c, 'div').class, 'tags');
    assert.equal(c.tags('span', { class: 'tag' }).length, 2);
  });
  it('renders nothing when omitted or empty', async () => {
    const p = await page('Tags');
    assert.equal(p.case('none').tags('div').length, 0);
    assert.equal(p.case('empty').tags('div').length, 0);
  });
});

describe('CommandBlock', () => {
  it('shows the label, the command, and a copy button for it', async () => {
    const c = (await page('CommandBlock')).case('single');
    assert.equal(c.tags('div', { class: 'cmds' }).length, 1);
    assert.equal(c.tags('span', { class: 'cmd-label' }).length, 1);
    assert.ok(c.text.includes('Install'));
    const code = attrs(c, 'code');
    assert.equal(code.class, 'cmd-text');
    assert.ok('data-copy-source' in code);
    assert.ok(!('data-multiline' in code));
    assert.ok('data-copy-root' in attrs(c, 'div', { class: 'cmd-row' }));
    const b = attrs(c, 'button');
    assert.equal(b['data-copy'], 'npm i x && npm test');
    assert.equal(b['aria-label'], 'Copy: npm i x && npm test');
  });
  it('has no label element without a label', async () => {
    assert.equal(
      (await page('CommandBlock')).case('unlabelled').tags('span', { class: 'cmd-label' }).length,
      0,
    );
  });
  it('flags multi-line scripts and uses a short aria-label', async () => {
    const c = (await page('CommandBlock')).case('multiline');
    assert.ok('data-multiline' in attrs(c, 'code'));
    const b = attrs(c, 'button');
    assert.equal(b['data-copy'], 'line1\nline2');
    assert.equal(b['aria-label'], 'Copy script');
  });
  it('uses the label in the multi-line aria-label', async () => {
    assert.equal(
      attrs((await page('CommandBlock')).case('multiline-labelled'), 'button')['aria-label'],
      'Copy Script',
    );
  });
  it('stacks one block per command', async () => {
    const c = (await page('CommandBlock')).case('list');
    assert.equal(c.tags('div', { class: 'cmds' }).length, 1);
    assert.equal(c.tags('div', { class: 'cmd' }).length, 2);
    assert.equal(c.tags('button').length, 2);
  });
  it('renders nothing when empty or omitted', async () => {
    const p = await page('CommandBlock');
    assert.equal(p.case('empty').tags('div').length, 0);
    assert.equal(p.case('omitted').tags('div').length, 0);
  });
});

describe('LinkList', () => {
  it('lists links; internal says View, external says Open and opens safely', async () => {
    const c = (await page('LinkList')).case('mixed');
    assert.equal(c.tags('div', { class: 'cmds related' }).length, 1);
    const [internal, external] = c.tags('a');
    assert.equal(internal.attrs.href, '/setup');
    assert.equal(internal.attrs.target, undefined);
    assert.equal(external.attrs.target, '_blank');
    assert.equal(external.attrs.rel, 'noopener noreferrer');
    assert.equal(c.tags('span', { class: 'cmd-label' }).length, 1);
    assert.equal(c.text, 'Guide Setup View Docs Open');
  });
  it('downloads: sets the file name, defaults the action to Download, never opens a new tab', async () => {
    const c = (await page('LinkList')).case('download');
    const a = attrs(c, 'a');
    assert.equal(a.download, 'x.json');
    assert.equal(a.target, undefined);
    assert.equal(c.text, 'x.json Download');
  });
  it('takes a custom action label', async () => {
    assert.equal((await page('LinkList')).case('action').text, 'y.json Save');
  });
  it('renders nothing when empty or omitted', async () => {
    const p = await page('LinkList');
    assert.equal(p.case('empty').tags('div').length, 0);
    assert.equal(p.case('omitted').tags('div').length, 0);
  });
});

describe('HubTrail', () => {
  it('links back to the hub and to each step, numbered', async () => {
    const c = (await page('HubTrail')).case('steps');
    const aside = attrs(c, 'aside');
    assert.equal(aside.class, 'hub-trail');
    assert.equal(aside['aria-label'], 'Where this fits in Setup Hub');
    assert.ok('data-pagefind-ignore' in aside);
    const chips = c.tags('a', { class: 'hub-chip' });
    assert.deepEqual(
      chips.map((t) => t.attrs.href),
      ['/hub#workflow-install', '/hub#workflow-tune'],
    );
    assert.ok(c.text.includes('Part of Setup Hub'));
    assert.ok(c.text.includes('Used in 01 Install 12 Tune'));
  });
  it('omits the steps section when there are none', async () => {
    const c = (await page('HubTrail')).case('no-steps');
    assert.equal(c.tags('a', { class: 'hub-chip' }).length, 0);
    assert.ok(!c.text.includes('Used in'));
  });
});

describe('Header', () => {
  it('shows the brand, version and primary navigation with the current page marked', async () => {
    const c = (await page('Header')).case('full');
    assert.ok(has(c, 'header', 'topbar'));
    assert.equal(c.tags('a', { class: 'brand' }).length, 1);
    assert.ok(c.text.includes('acme /'));
    assert.equal(c.tags('span', { class: 'brand-version' })[0].attrs.title, 'Site version');
    assert.ok(c.text.includes('v1.2.3'));
    assert.equal(attrs(c, 'nav', { 'aria-label': 'Primary' }).class, 'nav');
    const links = c.tags('a', { class: 'nav-link' });
    assert.equal(links.length, 4, 'desktop + mobile navigation');
    assert.deepEqual(
      links.filter((l) => l.attrs['aria-current'] === 'page').map((l) => l.attrs.href),
      ['/Header', '/Header'],
    );
  });
  it('has the search trigger and theme toggle', async () => {
    const c = (await page('Header')).case('full');
    assert.equal(attrs(c, 'button', { id: 'search-open' })['aria-label'], 'Open site search');
    assert.equal(attrs(c, 'button', { id: 'theme-toggle' })['aria-label'], 'Switch to light mode');
  });
  it('shows About and GitHub icons only when given', async () => {
    const p = await page('Header');
    const full = p.case('full');
    assert.equal(attrs(full, 'a', { 'aria-label': 'About me' }).href, '/about');
    const gh = attrs(full, 'a', { 'aria-label': 'GitHub' });
    assert.equal(gh.href, 'https://github.com/acme');
    assert.equal(gh.target, '_blank');
    const min = p.case('minimal');
    assert.equal(min.tags('a', { 'aria-label': 'About me' }).length, 0);
    assert.equal(min.tags('a', { 'aria-label': 'GitHub' }).length, 0);
    assert.equal(min.tags('span', { class: 'brand-version' }).length, 0);
  });
  it('ships its behaviour script with the page', async () => {
    assert.ok((await page('Header')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('Search', () => {
  it('is a hidden modal dialog kept out of the index', async () => {
    const c = (await page('Search')).case('default');
    const d = attrs(c, 'div', { id: 'search-overlay' });
    assert.equal(d.role, 'dialog');
    assert.equal(d['aria-modal'], 'true');
    assert.ok('hidden' in d);
    assert.ok('data-pagefind-ignore' in d);
    assert.equal(attrs(c, 'input', { id: 'search-input' }).type, 'search');
    assert.equal(c.tags('div', { id: 'search-results' }).length, 1);
    assert.equal(c.tags('template').length, 2, 'result icons');
  });
  it('takes a placeholder, with a generic default', async () => {
    const p = await page('Search');
    assert.equal(
      attrs(p.case('default'), 'input', { id: 'search-input' }).placeholder,
      'Search the site...',
    );
    assert.equal(
      attrs(p.case('custom'), 'input', { id: 'search-input' }).placeholder,
      'Find things',
    );
  });
  it('ships its script with the page', async () => {
    assert.ok((await page('Search')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('FilterBar', () => {
  it('is a search landmark with an input, sort select, tag chips and status', async () => {
    const c = (await page('FilterBar')).case('full');
    const bar = attrs(c, 'div', { role: 'search' });
    assert.ok('data-filter-bar' in bar);
    assert.equal(bar['data-total'], '5');
    assert.equal(attrs(c, 'input', { type: 'search' })['data-filter-input'], '');
    const select = attrs(c, 'select');
    assert.ok('data-filter-sort' in select);
    assert.deepEqual(
      c.tags('option').map((o) => o.attrs.value),
      ['default', 'title', 'updated', 'stars'],
    );
    assert.ok(c.text.includes('Recently updated') && c.text.includes('Most stars'));
    const chips = c.tags('button', { class: 'tag filter-chip' });
    assert.deepEqual(
      chips.map((b) => b.attrs['data-filter-tag']),
      ['alpha', 'beta'],
    );
    assert.ok(chips.every((b) => b.attrs['aria-pressed'] === 'false'));
    assert.ok('hidden' in attrs(c, 'button', { class: 'filter-clear' }));
  });
  it('omits the chip group when no tag distinguishes items', async () => {
    const c = (await page('FilterBar')).case('no-tags');
    assert.equal(c.tags('div', { class: 'filter-chips' }).length, 0);
    assert.equal(c.tags('option').length, 2);
  });
  it('ships its script with the page', async () => {
    assert.ok((await page('FilterBar')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('Workflow', () => {
  it('renders phases as rows of numbered, anchored step nodes', async () => {
    const c = (await page('Workflow')).case('graph');
    assert.equal(c.tags('li', { class: 'workflow-phase' }).length, 2);
    assert.ok(
      c.text.includes('Phase 1') && c.text.includes('Prepare') && c.text.includes('Get ready'),
    );
    assert.ok(c.text.includes('Phase 2') && c.text.includes('Build'));
    const heads = c.tags('h4');
    assert.deepEqual(heads.map((h) => h.attrs.id).filter(Boolean).length, 3);
    for (const n of ['01', '02', '03']) assert.ok(c.text.includes(n), n);
  });
  it('hands the edges to the script and shows progress', async () => {
    const c = (await page('Workflow')).case('graph');
    const root = attrs(c, 'div', { class: 'workflow' });
    assert.ok('data-workflow' in root);
    assert.deepEqual(JSON.parse(root['data-edges']), [
      { from: 'start', to: 'a' },
      { from: 'start', to: 'b' },
    ]);
    assert.ok(c.text.includes('0 of 3 steps done'));
    assert.ok('hidden' in attrs(c, 'button', { class: 'workflow-reset' }));
  });
  it('marks optional steps, shows branch badges and links, and lists requires / unlocks', async () => {
    const c = (await page('Workflow')).case('graph');
    const nodes = c.tags('article');
    const beta = nodes.find((n) => n.attrs['data-node'] === 'b')!;
    assert.ok(beta.attrs.class.split(' ').includes('is-optional'));
    assert.ok(beta.attrs.class.split(' ').includes('workflow-node'));
    assert.ok(c.text.includes('Optional') && c.text.includes('Side'));
    assert.equal(c.tags('a', { href: '/docs' }).length, 1);
    assert.ok(c.text.includes('Requires 01 Start'));
    assert.ok(c.text.includes('Unlocks 02 Alpha 03 Beta'));
    assert.equal(c.tags('a', { href: '#workflow-start' }).length, 2);
  });
  it('works with a single step', async () => {
    const c = (await page('Workflow')).case('single');
    assert.equal(c.tags('article').length, 1);
    assert.deepEqual(JSON.parse(attrs(c, 'div', { class: 'workflow' })['data-edges']), []);
    assert.ok(c.text.includes('0 of 1 steps done'));
  });
  it('ships its interaction script with the page', async () => {
    assert.ok((await page('Workflow')).tags('script', { type: 'module' }).length >= 1);
  });
});

describe('RepoMeta', () => {
  it('shows version, stars, freshness and visibility for a public repo', async () => {
    const c = (await page('RepoMeta')).case('full');
    const foot = attrs(c, 'div', { class: 'node-foot' });
    assert.equal(foot['data-repo'], 'o/r');
    assert.ok(!('data-private' in foot));
    const v = attrs(c, 'a', { 'data-role': 'version' });
    assert.equal(v.href, 'https://example.com/releases/v1.0.0');
    assert.equal(v.title, 'Latest release');
    assert.equal(v.target, '_blank');
    assert.ok(!('hidden' in v));
    assert.ok(!('data-prerelease' in v));
    assert.equal(attrs(c, 'span', { 'data-role': 'stars' }).title, 'GitHub stars');
    assert.ok(c.text.includes('v1.0.0') && c.text.includes('1,234'));
    assert.equal(attrs(c, 'span', { 'data-role': 'updated' })['data-fresh'], 'cold');
    assert.equal(attrs(c, 'span', { 'data-role': 'visibility' }).title, 'Public repository');
    assert.ok('hidden' in attrs(c, 'span', { 'data-icon': 'lock' }));
    assert.ok(!('hidden' in attrs(c, 'span', { 'data-icon': 'globe' })));
    assert.ok(c.text.includes('Public'));
  });
  it('flags pre-releases', async () => {
    const v = attrs((await page('RepoMeta')).case('prerelease'), 'a', { 'data-role': 'version' });
    assert.equal(v.title, 'Latest pre-release');
    assert.ok('data-prerelease' in v);
  });
  it('shows private repos as private, from info or from the isPrivate hint', async () => {
    const p = await page('RepoMeta');
    for (const id of ['private', 'known-private']) {
      const c = p.case(id);
      assert.ok('data-private' in attrs(c, 'div', { class: 'node-foot' }), id);
      assert.equal(attrs(c, 'span', { 'data-role': 'visibility' }).title, 'Private repository', id);
      assert.ok(!('hidden' in attrs(c, 'span', { 'data-icon': 'lock' })), id);
      assert.ok('hidden' in attrs(c, 'span', { 'data-icon': 'globe' }), id);
    }
  });
  it('names the host in the stars tooltip', async () => {
    assert.equal(
      attrs((await page('RepoMeta')).case('gitlab'), 'span', { 'data-role': 'stars' }).title,
      'GitLab stars',
    );
  });
  it('renders version and stars hidden until data arrives', async () => {
    const c = (await page('RepoMeta')).case('no-info');
    assert.ok('hidden' in attrs(c, 'a', { 'data-role': 'version' }));
    assert.ok('hidden' in attrs(c, 'span', { 'data-role': 'stars' }));
    assert.ok('hidden' in attrs(c, 'span', { 'data-role': 'updated' }));
  });
  it('falls back to a manual date without a repo, with no repo badges', async () => {
    const c = (await page('RepoMeta')).case('manual-date');
    const foot = attrs(c, 'div', { class: 'node-foot' });
    assert.equal(foot['data-repo'], undefined);
    assert.equal(c.tags('a', { 'data-role': 'version' }).length, 0);
    assert.equal(c.tags('span', { 'data-role': 'stars' }).length, 0);
    assert.equal(c.tags('span', { 'data-role': 'visibility' }).length, 0);
    assert.equal(attrs(c, 'span', { 'data-role': 'updated' })['data-fresh'], 'cold');
  });
  it('renders nothing with neither a repo nor a date', async () => {
    assert.equal((await page('RepoMeta')).case('nothing').tags('div').length, 0);
  });
});

describe('Layout', () => {
  it('builds a full document with title, description, icon and theme script', async () => {
    const p = await page('Layout');
    assert.equal(attrs(p, 'html', {})['data-theme'], 'dark');
    assert.match(p.html, /<title>Hello · Acme<\/title>/);
    assert.equal(attrs(p, 'meta', { name: 'description' }).content, 'A test page');
    assert.equal(attrs(p, 'meta', { property: 'og:title' }).content, 'Hello · Acme');
    assert.equal(attrs(p, 'link', { rel: 'icon' }).href, '/favicon.svg');
    assert.equal(p.tags('link', { rel: 'canonical' }).length, 0, 'no canonical without a site URL');
    assert.ok(p.html.includes("localStorage.getItem('theme')"));
    assert.equal(attrs(p, 'meta', { name: 'x-extra' }).content, '1', 'head slot');
  });
  it('turns on view transitions by default', async () => {
    const p = await page('Layout');
    assert.equal(attrs(p, 'meta', { name: 'astro-view-transitions-enabled' }).content, 'true');
    assert.ok(p.html.includes('astro:before-swap'));
    assert.ok(Object.keys(attrs(p, 'main')).some((k) => k.startsWith('data-astro-transition')));
  });
  it('renders the header, the page in <main> (indexed), the search overlay and the end slot', async () => {
    const p = await page('Layout');
    assert.ok(has(p, 'header', 'topbar'));
    assert.ok(p.text.includes('acme /') && p.text.includes('v9'));
    const main = attrs(p, 'main');
    assert.equal(main.class, 'page');
    assert.ok('data-pagefind-body' in main);
    assert.ok(!('data-pagefind-ignore' in main));
    const at = (needle: string) => p.html.indexOf(needle);
    assert.ok(at('id="page-body"') !== -1 && at('id="page-body"') < at('id="search-overlay"'));
    assert.ok(at('id="search-overlay"') < at('id="end-slot"'));
    assert.equal(attrs(p, 'input', { id: 'search-input' }).placeholder, 'Find it');
  });
  it('can drop transitions, hide a page from the index and swap the icon', async () => {
    const p = await page('LayoutPlain');
    assert.equal(p.tags('meta', { name: 'astro-view-transitions-enabled' }).length, 0);
    assert.ok(!p.html.includes('astro:before-swap'));
    const main = attrs(p, 'main');
    assert.ok(!Object.keys(main).some((k) => k.startsWith('data-astro-transition')));
    assert.ok(!('data-pagefind-body' in main));
    assert.equal(main['data-pagefind-ignore'], 'all');
    assert.equal(attrs(p, 'link', { rel: 'icon' }).href, '/mark.svg');
    assert.match(p.html, /<title>Acme<\/title>/);
    assert.equal(p.tags('meta', { name: 'description' }).length, 0);
  });
  it('ships the page-load script', async () => {
    assert.ok((await page('Layout')).tags('script', { type: 'module' }).length >= 1);
  });
  it('has no background unless asked', async () => {
    const p = await page('Layout');
    assert.ok(!('data-bg' in attrs(p, 'html', {})));
    assert.equal(attrs(p, 'html', {}).style, undefined);
    assert.equal(p.tags('div', { class: 'bg-layer' }).length, 0);
  });
  it('puts the background layer first in <body> and the card options on <html>', async () => {
    const p = await page('LayoutBackground');
    const html = attrs(p, 'html', {});
    assert.ok('data-bg' in html);
    assert.equal(html.style, '--card-blur:12px;--card-opacity:60%');
    const layer = attrs(p, 'div', { class: 'bg-layer' });
    assert.equal(layer.style, '--bg-image:url("/wall.jpg");--bg-blur:24px');
    assert.ok(p.html.indexOf('bg-layer') < p.html.indexOf('<header'));
  });
});
