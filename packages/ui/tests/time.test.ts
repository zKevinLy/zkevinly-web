import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { freshness, relativeTime } from '../src/lib/time.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-07T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('relativeTime', () => {
  it('says "just now" under a minute (past or future)', () => {
    assert.equal(relativeTime(ago(30_000), NOW), 'just now');
    assert.equal(relativeTime(ago(-30_000), NOW), 'just now');
  });

  it('formats minutes, hours, days, weeks, months, years', () => {
    assert.equal(relativeTime(ago(5 * 60_000), NOW), '5 minutes ago');
    assert.equal(relativeTime(ago(11 * 3_600_000), NOW), '11 hours ago');
    assert.equal(relativeTime(ago(DAY), NOW), 'yesterday');
    assert.equal(relativeTime(ago(4 * DAY), NOW), '4 days ago');
    assert.equal(relativeTime(ago(14 * DAY), NOW), '2 weeks ago');
    assert.equal(relativeTime(ago(60 * DAY), NOW), '2 months ago');
    assert.equal(relativeTime(ago(400 * DAY), NOW), 'last year');
  });

  it('handles the future', () => {
    assert.equal(relativeTime(ago(-2 * 3_600_000), NOW), 'in 2 hours');
  });
});

describe('freshness', () => {
  it('is hot within 14 days, warm within 90, otherwise cold', () => {
    assert.equal(freshness(ago(0), NOW), 'hot');
    assert.equal(freshness(ago(14 * DAY), NOW), 'hot');
    assert.equal(freshness(ago(15 * DAY), NOW), 'warm');
    assert.equal(freshness(ago(90 * DAY), NOW), 'warm');
    assert.equal(freshness(ago(91 * DAY), NOW), 'cold');
  });
});
