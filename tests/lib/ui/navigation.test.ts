import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActivePath, normalizePath } from '../../../src/lib/ui/navigation';

test('normalizePath strips trailing slashes', () => {
  assert.equal(normalizePath('/toolkit/'), '/toolkit');
  assert.equal(normalizePath(''), '/');
});

test('isActivePath matches the page and anything below it', () => {
  assert.equal(isActivePath('/toolkit', '/toolkit'), true);
  assert.equal(isActivePath('/toolkit/invoice', '/toolkit'), true);
  assert.equal(isActivePath('/toolkits', '/toolkit'), false);
});
