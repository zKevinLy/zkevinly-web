import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type Dom } from '../helpers/dom';
import { applyRepoInfo, versionTitle } from '../../packages/ui/src/lib/repo-info';
import type { RepoInfo } from '../../packages/ui/src/types';

const FOOT = `
<article data-filter-item>
  <footer class="node-foot" data-repo="o/r">
    <span data-role="visibility"><i data-icon="lock" hidden></i><i data-icon="globe"></i><b data-role="visibility-text"></b></span>
    <a data-role="version" hidden><span data-role="version-text"></span></a>
    <span data-role="stars" hidden><span data-role="stars-text"></span></span>
    <span data-role="updated" hidden><time></time></span>
  </footer>
</article>`;

const PUSHED = new Date(Date.now() - 3 * 86_400_000).toISOString();
const info = (over: Partial<RepoInfo> = {}): RepoInfo => ({
  pushedAt: PUSHED,
  stars: 12345,
  version: 'v1.2.3',
  releaseUrl: 'https://github.com/o/r/releases/tag/v1.2.3',
  prerelease: false,
  private: false,
  ...over,
});

let dom: Dom;
const mount = (html = FOOT) => {
  dom.document.body.innerHTML = html;
  return dom.document.querySelector<HTMLElement>('.node-foot')!;
};
const q = (sel: string) => dom.document.querySelector<HTMLElement>(sel)!;

beforeEach(() => {
  dom = installDom();
});
afterEach(() => dom.restore());

describe('versionTitle', () => {
  it('names pre-releases', () => {
    assert.equal(versionTitle(true), 'Latest pre-release');
    assert.equal(versionTitle(false), 'Latest release');
    assert.equal(versionTitle(undefined), 'Latest release');
  });
});

describe('applyRepoInfo', () => {
  it('paints a public repo: version, stars, freshness, visibility', () => {
    const foot = mount();
    applyRepoInfo(foot, info());
    assert.equal(q('[data-role=version]').hidden, false);
    assert.equal(q('[data-role=version-text]').textContent, 'v1.2.3');
    assert.equal(
      q('[data-role=version]').getAttribute('href'),
      'https://github.com/o/r/releases/tag/v1.2.3',
    );
    assert.equal(q('[data-role=version]').title, 'Latest release');
    assert.equal(q('[data-role=version]').hasAttribute('data-prerelease'), false);
    assert.equal(q('[data-role=stars]').hidden, false);
    assert.equal(q('[data-role=stars-text]').textContent, '12,345');
    assert.equal(q('[data-role=updated]').hidden, false);
    assert.equal(q('[data-role=updated]').dataset.fresh, 'hot');
    assert.match(q('time').textContent!, /3 days ago/);
    assert.equal(q('time').getAttribute('datetime'), PUSHED);
    assert.equal(q('time').title, new Date(PUSHED).toUTCString());
    assert.equal(q('[data-role=visibility]').title, 'Public repository');
    assert.equal(q('[data-role=visibility-text]').textContent, 'Public');
    assert.equal(q('[data-icon=lock]').hidden, true);
    assert.equal(q('[data-icon=globe]').hidden, false);
    assert.equal(foot.hasAttribute('data-private'), false);
  });

  it('marks private repos and pre-releases', () => {
    const foot = mount();
    applyRepoInfo(foot, info({ private: true, prerelease: true }));
    assert.equal(q('[data-role=visibility]').title, 'Private repository');
    assert.equal(q('[data-role=visibility-text]').textContent, 'Private');
    assert.equal(q('[data-icon=lock]').hidden, false);
    assert.equal(q('[data-icon=globe]').hidden, true);
    assert.equal(foot.hasAttribute('data-private'), true);
    assert.equal(q('[data-role=version]').title, 'Latest pre-release');
    assert.equal(q('[data-role=version]').hasAttribute('data-prerelease'), true);
  });

  it('hides the version when there is no release, and keeps the old link without a new one', () => {
    const foot = mount();
    applyRepoInfo(foot, info({ version: null, releaseUrl: null }));
    assert.equal(q('[data-role=version]').hidden, true);
    q('[data-role=version]').setAttribute('href', 'https://old.example/');
    applyRepoInfo(foot, info({ releaseUrl: null }));
    assert.equal(q('[data-role=version]').getAttribute('href'), 'https://old.example/');
  });

  it('leaves the date alone when GitHub sends none', () => {
    const foot = mount();
    applyRepoInfo(foot, info({ pushedAt: '' }));
    assert.equal(q('[data-role=updated]').hidden, true);
  });

  it('feeds the page filter so sort-by-stars and sort-by-updated see the new numbers', () => {
    const foot = mount();
    applyRepoInfo(foot, info({ stars: 7 }));
    const item = q('[data-filter-item]');
    assert.equal(item.dataset.filterStars, '7');
    assert.equal(item.dataset.filterUpdated, PUSHED);
  });

  it('copes with a footer that has none of the parts, and one outside a filter item', () => {
    const foot = mount('<footer class="node-foot"></footer>');
    assert.doesNotThrow(() => applyRepoInfo(foot, info()));
    const partial = mount(`<footer class="node-foot">
      <span data-role="visibility"></span>
      <a data-role="version"></a>
      <span data-role="stars"></span>
      <span data-role="updated"></span></footer>`);
    assert.doesNotThrow(() => applyRepoInfo(partial, info()));
    assert.equal(q('[data-role=visibility]').title, 'Public repository');
  });
});
