import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../worker/index.js';

const served: string[] = [];
const env = {
  ASSETS: {
    fetch: async (r: Request) => (served.push(new URL(r.url).pathname), new Response('asset')),
  },
};
const ctx = { waitUntil() {} };
const call = (path: string, method = 'GET') =>
  worker.fetch(new Request(`https://zkevinly.com${path}`, { method }), env, ctx);

describe('Worker routing', () => {
  it('sends /api/gif, /api/repo and /api/ping to their handlers', async () => {
    // Each handler answers its own way without a network call for these inputs.
    assert.equal((await call('/api/gif?q=')).status, 400);
    assert.equal((await call('/api/repo?repo=nobody/nothing')).status, 404);
    assert.equal((await call('/api/ping?url=https://example.invalid/')).status, 404);
  });

  it('hands everything else to the static assets', async () => {
    served.length = 0;
    const res = await call('/about');
    assert.equal(await res.text(), 'asset');
    assert.deepEqual(served, ['/about']);
  });

  it('does not treat look-alike paths as API routes', async () => {
    served.length = 0;
    for (const path of ['/api/gif/', '/api/gifs', '/api', '/API/gif']) {
      const res = await call(path);
      assert.equal(await res.text(), 'asset', path);
    }
  });
});
