import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Html, Page } from './html';

// The HTML helpers the component tests rely on. Runs without building anything.

describe('Html helper', () => {
  const html = new Html(
    `<div class="a b" data-x><a href="/x?y=1&#38;z=2" hidden>Hi &amp; bye</a><a href='/y'>2</a>` +
      `<button data-copy="a &#38;&#38; b > c">c</button><script>if (1<2) {}</script></div>`,
  );

  it('finds tags and parses quoted, single-quoted and bare attributes', () => {
    assert.equal(html.tags('a').length, 2);
    assert.deepEqual(html.tag('div').attrs, { class: 'a b', 'data-x': '' });
    assert.equal(html.tags('a')[1].attrs.href, '/y');
    assert.ok('hidden' in html.tags('a')[0].attrs);
  });
  it('decodes entities, including a ">" inside a quoted value', () => {
    assert.equal(html.tags('a')[0].attrs.href, '/x?y=1&z=2');
    assert.equal(html.tag('button').attrs['data-copy'], 'a && b > c');
  });
  it('filters by exact string or regex', () => {
    assert.equal(html.tags('a', { href: '/y' }).length, 1);
    assert.equal(html.tags('a', { href: /^\/x/ }).length, 1);
  });
  it('tag() throws unless there is exactly one match', () => {
    assert.throws(() => html.tag('a'), /exactly 1/);
    assert.throws(() => html.tag('p'), /exactly 1/);
  });
  it('hasClass matches whole tokens', () => {
    assert.ok(html.hasClass('div', 'b'));
    assert.ok(!html.hasClass('div', 'ab'));
  });
  it('ignores tags that appear inside comments and script/style bodies', () => {
    const h = new Html(
      '<!-- uses <main> here --><main class="x"></main><script type="module">a<b>c</script><style>p<q>{}</style>',
    );
    assert.equal(h.tags('main').length, 1);
    assert.equal(h.tags('b').length, 0);
    assert.equal(h.tags('q').length, 0);
    assert.equal(h.tags('script', { type: 'module' }).length, 1, 'the script tag itself is kept');
  });
  it('text drops tags and scripts and collapses whitespace', () => {
    assert.equal(html.text, 'Hi & bye 2 c');
  });
});

describe('Page.case', () => {
  const page = new Page(
    '<test-case id="one"><b>1</b></test-case>\n<test-case id="two">2</test-case>',
  );
  it('extracts a named case', () => {
    assert.equal(page.case('one').tags('b').length, 1);
    assert.equal(page.case('two').text, '2');
  });
  it('throws for a missing case', () => {
    assert.throws(() => page.case('nope'), /no test case "nope"/);
  });
});

describe('Html helper: hostile input', () => {
  it('does not rebuild a comment or script from nested fragments', () => {
    assert.equal(new Html('<!<!---->-->x').text.includes('<'), false);
    assert.equal(new Html('<scr<script>ipt>alert(1)</scr</script>ipt>').tags('script').length, 0);
  });
  it('closes script on </script > and is case-insensitive', () => {
    const h = new Html('<SCRIPT>a<b></script ><i>ok</i>');
    assert.equal(h.tags('b').length, 0);
    assert.equal(h.text, 'ok');
  });
  it('handles unterminated comments, tags and a lone <', () => {
    assert.equal(new Html('a <!-- never closed <b>').tags('b').length, 0);
    assert.equal(new Html('<div class="x').tags('div').length, 0);
    assert.equal(new Html('1 < 2').text, '1 < 2');
  });
  it('stays fast on pathological input', () => {
    const t = Date.now();
    new Html('<a' + ' b'.repeat(50_000)).tags('a');
    new Html('<' + 'a="'.repeat(50_000)).text;
    assert.ok(Date.now() - t < 1000);
  });
});
