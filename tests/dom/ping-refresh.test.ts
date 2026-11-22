import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, type Dom } from '../helpers/dom';

let dom: Dom;
let calls: string[];
let answer: (url: string) => Promise<unknown>;

const card = (url: string, via?: string, dot = true) =>
  `<article data-ping-url="${url}" ${via ? `data-ping-via="${via}"` : ''}>${
    dot ? '<span class="node-ping"><span class="node-ping-text" hidden></span></span>' : ''
  }</article>`;
const mount = (...cards: string[]) => (dom.document.body.innerHTML = cards.join(''));
const states = () =>
  [...dom.document.querySelectorAll<HTMLElement>('.node-ping')].map((d) => d.dataset.state);
const pageLoad = () => dom.document.dispatchEvent(new dom.window.Event('astro:page-load'));
const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

before(async () => {
  dom = installDom();
  await import('../../src/scripts/ping-refresh');
});
after(() => dom.restore());

beforeEach(() => {
  calls = [];
  answer = async () => json({ up: true, ms: 12 });
  mock.method(
    globalThis,
    'fetch',
    async (url: string) => (calls.push(String(url)), answer(String(url))),
  );
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
});
afterEach(() => {
  dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
  mock.timers.reset();
  mock.restoreAll();
  Object.defineProperty(dom.document, 'hidden', { configurable: true, value: false });
});

describe('ping refresh (Worker)', () => {
  it('does nothing on a page without ping cards', async () => {
    mount('<p>no pings</p>');
    pageLoad();
    await settle();
    assert.deepEqual(calls, []);
  });

  it('asks the Worker once per distinct URL and paints every dot that shows it', async () => {
    mount(card('https://a.example/'), card('https://a.example/'), card('https://b.example/'));
    pageLoad();
    await settle();
    assert.deepEqual(calls.sort(), [
      '/api/ping?url=' + encodeURIComponent('https://a.example/'),
      '/api/ping?url=' + encodeURIComponent('https://b.example/'),
    ]);
    assert.deepEqual(states(), ['up', 'up', 'up']);
    assert.equal(dom.document.querySelector('.node-ping-text')!.textContent, '12 ms');
  });

  it('skips cards with no dot or no URL', async () => {
    mount(
      card('https://a.example/', undefined, false),
      '<article data-ping-url=""><span class="node-ping"></span></article>',
    );
    pageLoad();
    await settle();
    assert.deepEqual(calls, []);
  });

  it('reads anything unexpected as "unknown"', async () => {
    for (const reply of [
      async () => json({}, false),
      async () => json({ up: 'yes' }),
      async () => {
        throw new Error('offline');
      },
    ]) {
      answer = reply;
      mount(card('https://a.example/'));
      pageLoad();
      await settle();
      assert.deepEqual(states(), ['unknown']);
    }
  });

  it('shows a host that answers "down" as down', async () => {
    answer = async () => json({ up: false });
    mount(card('https://a.example/'));
    pageLoad();
    await settle();
    assert.deepEqual(states(), ['down']);
  });
});

describe('ping refresh (visitor’s browser)', () => {
  it('asks the host itself, with a no-cors request, and times it', async () => {
    let init: RequestInit | undefined;
    mock.restoreAll();
    mock.method(
      globalThis,
      'fetch',
      async (url: string, i?: RequestInit) => (calls.push(url), (init = i), {}),
    );
    mount(card('http://nas.lab/', 'browser'));
    pageLoad();
    await settle();
    assert.deepEqual(calls, ['http://nas.lab/']);
    assert.equal(init?.mode, 'no-cors');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    assert.deepEqual(states(), ['up']);
  });

  it('reads any failure as down', async () => {
    answer = async () => {
      throw new TypeError('blocked');
    };
    mount(card('http://nas.lab/', 'browser'));
    pageLoad();
    await settle();
    assert.deepEqual(states(), ['down']);
  });

  it('keeps Worker and browser checks of the same URL separate', async () => {
    mount(card('https://a.example/'), card('https://a.example/', 'browser'));
    pageLoad();
    await settle();
    assert.equal(calls.length, 2);
  });
});

describe('ping refresh timing', () => {
  it('re-checks every minute while the tab is visible', async () => {
    mount(card('https://a.example/'));
    pageLoad();
    await settle();
    assert.equal(calls.length, 1);
    mock.timers.tick(60_000);
    await settle();
    assert.equal(calls.length, 2);
  });

  it('skips a check while the tab is in the background', async () => {
    mount(card('https://a.example/'));
    pageLoad();
    await settle();
    Object.defineProperty(dom.document, 'hidden', { configurable: true, value: true });
    mock.timers.tick(60_000);
    await settle();
    assert.equal(calls.length, 1);
  });

  it('stops before a page swap, and a second page load does not stack timers', async () => {
    mount(card('https://a.example/'));
    pageLoad();
    pageLoad();
    await settle();
    assert.equal(calls.length, 2);
    dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
    mock.timers.tick(180_000);
    await settle();
    assert.equal(calls.length, 2);
  });

  it('stopping when nothing is running is harmless', () => {
    dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
    dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
  });

  it('does not start a timer on a page with no ping cards', async () => {
    mount('<p>none</p>');
    pageLoad();
    mock.timers.tick(120_000);
    await settle();
    assert.deepEqual(calls, []);
  });
});
