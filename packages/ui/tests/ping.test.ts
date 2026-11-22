import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pingView } from '../src/lib/ping';

describe('pingView', () => {
  it('is pending while a check runs, with no text', () => {
    assert.deepEqual(pingView('pending'), {
      state: 'pending',
      text: '',
      label: 'Status: checking',
    });
  });

  it('is unknown when the check itself could not run', () => {
    assert.deepEqual(pingView('unknown'), {
      state: 'unknown',
      text: '',
      label: 'Status unavailable',
    });
  });

  it('shows the response time, rounded, when up', () => {
    assert.deepEqual(pingView({ up: true, ms: 12.6 }), {
      state: 'up',
      text: '13 ms',
      label: 'Status: up, 13 ms',
    });
  });

  it('says plain "Up" when the time is unknown or not a number', () => {
    for (const ms of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(pingView({ up: true, ms }), {
        state: 'up',
        text: 'Up',
        label: 'Status: up',
      });
    }
  });

  it('never shows a negative time', () => {
    assert.equal(pingView({ up: true, ms: -4 }).text, '0 ms');
  });

  it('is down without a time, even if one was reported', () => {
    assert.deepEqual(pingView({ up: false, ms: 5000 }), {
      state: 'down',
      text: 'Down',
      label: 'Status: down',
    });
  });
});
