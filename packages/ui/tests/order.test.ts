import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrange, distribute, emptyOrder, MAX_COLUMNS, parseOrder } from '../src/lib/order';

const entry = (key: string, index: number) => ({ key, index });

test('nothing saved, or something unreadable, is an empty order', () => {
  for (const bad of [
    null,
    undefined,
    '',
    'not json',
    '42',
    'null',
    '[]',
    '{}',
    '{"groups":"a","items":{}}',
    '{"groups":[1],"items":{}}',
    '{"groups":[],"items":[]}',
    '{"groups":[],"items":"x"}',
    '{"groups":[]}',
  ]) {
    assert.deepEqual(parseOrder(bad), emptyOrder(), String(bad));
  }
});

test('a saved order round-trips', () => {
  const saved = {
    groups: ['AI', 'Media'],
    items: { Media: ['plexio', 'nuvio'], AI: [] },
    columns: 2,
    placement: { Media: 0, AI: 1 },
  };
  assert.deepEqual(parseOrder(JSON.stringify(saved)), saved);
});

test('lists that are not lists of strings are dropped; __proto__ is never copied', () => {
  const text = '{"groups":[],"items":{"Media":["a"],"AI":[1,2],"Misc":"x","__proto__":["evil"]}}';
  const order = parseOrder(text);
  assert.deepEqual(order, { groups: [], items: { Media: ['a'] }, columns: 1, placement: {} });
  assert.equal(Object.getPrototypeOf(order.items), Object.prototype);
});

test('arrange follows the saved order', () => {
  const entries = [entry('a', 0), entry('b', 1), entry('c', 2)];
  assert.deepEqual(
    arrange(entries, ['c', 'a', 'b']).map((e) => e.key),
    ['c', 'a', 'b'],
  );
});

test('arrange puts entries that were not saved last, in config order', () => {
  const entries = [entry('a', 0), entry('new1', 1), entry('b', 2), entry('new2', 3)];
  assert.deepEqual(
    arrange(entries, ['b', 'a']).map((e) => e.key),
    ['b', 'a', 'new1', 'new2'],
  );
});

test('arrange ignores saved names that no longer exist, and with nothing saved is config order', () => {
  const entries = [entry('b', 1), entry('a', 0), entry('c', 2)];
  assert.deepEqual(
    arrange(entries, ['gone', 'c']).map((e) => e.key),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    arrange(entries, []).map((e) => e.key),
    ['a', 'b', 'c'],
  );
});

test('arrange keeps repeated names stable and does not change its input', () => {
  const entries = [entry('x', 0), entry('x', 1), entry('y', 2)];
  const before = structuredClone(entries);
  assert.deepEqual(arrange(entries, ['y', 'x', 'y']), [
    entry('y', 2),
    entry('x', 0),
    entry('x', 1),
  ]);
  assert.deepEqual(entries, before);
});

test('an order saved before columns existed is one column with nothing placed', () => {
  const order = parseOrder('{"groups":["AI"],"items":{"AI":["ollama"]}}');
  assert.equal(order.columns, 1);
  assert.deepEqual(order.placement, {});
});

test('a column count outside 1..MAX_COLUMNS, or not a whole number, falls back to one column', () => {
  for (const bad of [0, -1, MAX_COLUMNS + 1, 2.5, '2', null, true]) {
    const order = parseOrder(JSON.stringify({ groups: [], items: {}, columns: bad }));
    assert.equal(order.columns, 1, String(bad));
  }
  for (let count = 1; count <= MAX_COLUMNS; count++) {
    assert.equal(
      parseOrder(JSON.stringify({ groups: [], items: {}, columns: count })).columns,
      count,
    );
  }
});

test('placements outside the columns are dropped; __proto__ is never copied', () => {
  const text =
    '{"groups":[],"items":{},"columns":2,"placement":{"AI":1,"Media":0,"Far":9,"Neg":-1,"Half":0.5,"Str":"1","__proto__":1}}';
  const order = parseOrder(text);
  assert.deepEqual(order.placement, { AI: 1, Media: 0 });
  assert.equal(Object.getPrototypeOf(order.placement), Object.prototype);
});

test('a placement that is not an object is ignored', () => {
  for (const bad of ['[1]', '"x"', '3', 'null']) {
    const order = parseOrder(`{"groups":[],"items":{},"columns":2,"placement":${bad}}`);
    assert.deepEqual(order.placement, {}, bad);
  }
});

test('distribute fills the emptiest column, leftmost on a tie', () => {
  // Media (6) and AI (4) land in separate columns; Automation (2) joins the lighter one.
  assert.deepEqual(distribute([6, 4, 2], 2), [0, 1, 1]);
  assert.deepEqual(distribute([1, 1, 1, 1], 2), [0, 1, 0, 1]);
  assert.deepEqual(distribute([5, 5, 5], 3), [0, 1, 2]);
});

test('distribute with one column puts everything in it; with nothing it returns nothing', () => {
  assert.deepEqual(distribute([3, 1, 2], 1), [0, 0, 0]);
  assert.deepEqual(distribute([], 3), []);
});

test('distribute keeps placed sections where they are and balances the rest around them', () => {
  // Section 0 is pinned to column 1 (weight 6), so the others go to column 0 until it catches up.
  assert.deepEqual(distribute([6, 2, 2, 2], 2, [1]), [1, 0, 0, 0]);
  // Both columns reach 6 after the third; the tie goes left, and only then does column 1 get more.
  assert.deepEqual(distribute([6, 2, 2, 2, 2], 2, [1]), [1, 0, 0, 0, 0]);
  assert.deepEqual(distribute([6, 2, 2, 2, 2, 2], 2, [1]), [1, 0, 0, 0, 0, 1]);
});

test('distribute treats a placement in a column that does not exist as not placed', () => {
  assert.deepEqual(distribute([2, 2], 2, [5, -1]), [0, 1]);
  assert.deepEqual(distribute([2, 2], 2, [undefined, 0.5]), [0, 1]);
});
