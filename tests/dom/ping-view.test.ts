import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type Dom } from '../helpers/dom';
import { applyPing } from '../../packages/ui/src/lib/ping';

let dom: Dom;
beforeEach(() => {
  dom = installDom();
});
afterEach(() => dom.restore());

const dot = (withText = true) => {
  dom.document.body.innerHTML = `<span class="node-ping">${withText ? '<span class="node-ping-text" hidden></span>' : ''}</span>`;
  return dom.document.querySelector<HTMLElement>('.node-ping')!;
};
const text = () => dom.document.querySelector<HTMLElement>('.node-ping-text')!;

describe('applyPing', () => {
  it('paints an answer: state, label, tooltip and the time', () => {
    const el = dot();
    applyPing(el, { up: true, ms: 12.4 });
    assert.equal(el.dataset.state, 'up');
    assert.equal(el.getAttribute('aria-label'), 'Status: up, 12 ms');
    assert.equal(el.title, 'Status: up, 12 ms');
    assert.equal(text().textContent, '12 ms');
    assert.equal(text().hidden, false);
  });

  it('hides the text while there is nothing to say', () => {
    const el = dot();
    applyPing(el, { up: true, ms: 5 });
    applyPing(el, 'pending');
    assert.equal(el.dataset.state, 'pending');
    assert.equal(text().textContent, '');
    assert.equal(text().hidden, true);
  });

  it('shows down and unknown', () => {
    const el = dot();
    applyPing(el, { up: false });
    assert.equal(el.dataset.state, 'down');
    assert.equal(text().textContent, 'Down');
    applyPing(el, 'unknown');
    assert.equal(el.dataset.state, 'unknown');
  });

  it('works on a dot with no text element', () => {
    const el = dot(false);
    applyPing(el, { up: true });
    assert.equal(el.dataset.state, 'up');
    assert.equal(el.getAttribute('aria-label'), 'Status: up');
  });
});
