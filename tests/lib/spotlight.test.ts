import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPath, encodePending, pickCandidate, readPending } from '../../src/lib/spotlight';

describe('spotlight pending hand-off', () => {
  it('round-trips a result click', () => {
    const raw = encodePending(
      { pathname: '/collections/nuvio/', hash: '#node-aiostreams' },
      ['AIOStreams'],
      1000,
    );
    assert.deepEqual(readPending(raw, 2000), {
      path: '/collections/nuvio',
      hash: '#node-aiostreams',
      terms: ['aiostreams'],
      at: 1000,
    });
  });

  it('drops expired or malformed values', () => {
    const raw = encodePending({ pathname: '/a', hash: '' }, ['x'], 0);
    assert.equal(readPending(raw, 60_000), null);
    assert.equal(readPending('not json'), null);
    assert.equal(readPending('{"path":1}'), null);
    assert.equal(readPending(null), null);
  });

  it('normalises paths', () => {
    assert.equal(cleanPath('/a/b/'), '/a/b');
    assert.equal(cleanPath('/'), '/');
  });
});

describe('pickCandidate', () => {
  const nodes = [
    { title: 'Install Nuvio', text: 'Install Nuvio. Sign in on the website.' },
    { title: 'AIOStreams', text: 'Configure AIOStreams for every stream addon.' },
    { title: 'Trakt', text: 'Connect Trakt. Works with AIOStreams too.' },
  ];

  it('prefers a title match over a body match', () => {
    assert.equal(pickCandidate(nodes, ['aiostreams']), 1);
  });

  it('requires every term to match', () => {
    assert.equal(pickCandidate(nodes, ['trakt', 'aiostreams']), 2);
    assert.equal(pickCandidate(nodes, ['trakt', 'missing']), -1);
  });

  it('returns -1 with no usable terms', () => {
    assert.equal(pickCandidate(nodes, []), -1);
    assert.equal(pickCandidate(nodes, ['  ']), -1);
  });
});
