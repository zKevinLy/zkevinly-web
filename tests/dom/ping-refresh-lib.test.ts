import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, settle, type Dom } from '../helpers/dom';

// The package loop used directly, with no `key`: cards with the same URL share one check.
let dom: Dom;
let stop: () => void;
const calls: string[] = [];

before(async () => {
  dom = installDom();
  const { startPingRefresh } = await import('@zkevinly/ui/lib/ping-refresh');
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  stop = startPingRefresh({ check: async (url) => (calls.push(url), 'unknown') });
});
afterEach(() => stop());
after(() => {
  mock.timers.reset();
  dom.restore();
});

describe('startPingRefresh without a key', () => {
  it('shares one check between cards with the same URL', async () => {
    const dot = '<span class="node-ping"><span class="node-ping-text" hidden></span></span>';
    dom.document.body.innerHTML = [1, 2]
      .map(() => `<article data-ping-url="https://a.example/">${dot}</article>`)
      .join('');
    dom.document.dispatchEvent(new dom.window.Event('astro:page-load'));
    await settle();
    assert.deepEqual(calls, ['https://a.example/']);
    assert.deepEqual(
      [...dom.document.querySelectorAll<HTMLElement>('.node-ping')].map((d) => d.dataset.state),
      ['unknown', 'unknown'],
    );
  });
});
