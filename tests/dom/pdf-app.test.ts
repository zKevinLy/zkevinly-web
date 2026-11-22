import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { installDom, settle, waitFor, type Dom } from '../helpers/dom';
import { initPdfTool } from '../../src/lib/toolkit/pdf/ui/app';
import { buildPdf, newDoc, serialize } from '../../src/lib/toolkit/pdf/engine';
import { getType, typeList } from '../../src/lib/toolkit/pdf/types';
import type { AnyDocType } from '../../src/lib/toolkit/pdf/doctype';

const FIXTURE = `
<div data-pdf-tool>
  <div role="group">${typeList.map((t) => `<button data-type="${t.id}" aria-pressed="false">${t.label}</button>`).join('')}<button data-type="bogus"></button></div>
  <p data-type-blurb></p>
  <button data-action="pdf"></button><button data-action="load"></button><button data-action="json"></button>
  <button data-action="example" hidden></button><button data-action="new"></button>
  <input type="file" hidden data-file-input />
  <p data-status data-kind="info"></p>
  <p data-preview-note hidden></p>
  <div role="group"><button data-view="json" aria-pressed="true"></button><button data-view="form" aria-pressed="false"></button></div>
  <section data-editor><button data-action="editor-format"></button><textarea data-editor-text></textarea><p data-editor-status data-kind="info"></p></section>
  <form data-form hidden></form>
  <iframe data-preview data-front="true"></iframe>
  <iframe data-preview data-front="false" aria-hidden="true" inert tabindex="-1"></iframe>
  <button data-preview-open hidden></button>
  <div data-drop-overlay hidden></div>
</div>`;

let dom: Dom;
let downloads: { name: string; href: string }[];
let confirms: string[];
let confirmAnswer: boolean;
let opened: unknown[][];
let revoked: string[];

const q = <T extends HTMLElement = HTMLElement>(sel: string) => dom.document.querySelector<T>(sel)!;
const action = (name: string) => q(`[data-action="${name}"]`);
const frames = () => [...dom.document.querySelectorAll<HTMLIFrameElement>('[data-preview]')];
const status = () => q('[data-status]');
const editorText = () => q<HTMLTextAreaElement>('[data-editor-text]');
const editorStatus = () => q('[data-editor-status]');
const click = (el: Element) =>
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const input = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const tick = (ms: number) => mock.timers.tick(ms);
const hasBlobSrc = (frame: HTMLIFrameElement) => frame.src.startsWith('blob:');

async function start(opts: { url?: string; html?: string; before?: () => void } = {}) {
  dom = installDom(
    `<!doctype html><html><body>${opts.html ?? FIXTURE}</body></html>`,
    opts.url ?? 'https://zkevinly.com/toolkit/pdf',
  );
  downloads = [];
  confirms = [];
  confirmAnswer = true;
  opened = [];
  revoked = [];
  mock.timers.enable({ apis: ['setTimeout'] });
  mock.method(dom.window.HTMLAnchorElement.prototype, 'click', function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href });
  });
  const realRevoke = URL.revokeObjectURL.bind(URL);
  mock.method(URL, 'revokeObjectURL', (url: string) => (revoked.push(url), realRevoke(url)));
  (dom.window as unknown as Record<string, unknown>).confirm = (message: string) => (
    confirms.push(message),
    confirmAnswer
  );
  (dom.window as unknown as Record<string, unknown>).open = (...args: unknown[]) => (
    opened.push(args),
    null
  );
  opts.before?.();
  initPdfTool();
}

/** Opens the form view and types into its first text input: the document is now "dirty". */
function makeDirty() {
  click(q('[data-view="form"]'));
  const field = q<HTMLInputElement>('[data-form] input[type=text], [data-form] input:not([type])');
  input(field, 'changed');
}

const fileInput = () => q<HTMLInputElement>('[data-file-input]');
function choose(file: unknown) {
  Object.defineProperty(fileInput(), 'files', { configurable: true, value: file ? [file] : [] });
  fileInput().dispatchEvent(new dom.window.Event('change'));
}
const jsonOf = (type: AnyDocType) => serialize(type, newDoc(type));
/** Pasted into the editor: an invoice with a line quantity that is not a number. */
const BAD_QUANTITY = JSON.stringify({
  items: [{ description: 'x', quantity: 'abc', unitPrice: '1' }],
});
const withProblem = () => {
  input(editorText(), BAD_QUANTITY);
  tick(300);
};

beforeEach(() => undefined);
afterEach(() => {
  dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
  mock.timers.reset();
  mock.restoreAll();
  dom.restore();
  for (const t of [getType('invoice'), getType('custom')])
    if (t) delete (t as { __layout?: unknown }).__layout;
});

describe('start-up', () => {
  it('does nothing on a page without the tool', async () => {
    await start({ html: '<p>other page</p>' });
    assert.equal(dom.document.querySelector('[data-form]'), null);
  });

  it('opens the default type in the JSON view and records it in the URL', async () => {
    await start();
    assert.equal(JSON.parse(editorText().value).type, 'invoice');
    assert.equal(q('[data-form]').hidden, true);
    assert.equal(q('[data-editor]').hidden, false);
    assert.equal(q('[data-view="json"]').getAttribute('aria-pressed'), 'true');
    assert.equal(q('[data-view="form"]').getAttribute('aria-pressed'), 'false');
    assert.equal(q('[data-type="invoice"]').getAttribute('aria-pressed'), 'true');
    assert.equal(q('[data-type="service-log"]').getAttribute('aria-pressed'), 'false');
    assert.ok(q('[data-type-blurb]').textContent!.length > 0);
    assert.equal(action('example').hidden, false);
    assert.equal(new URL(dom.window.location.href).searchParams.get('type'), 'invoice');
    assert.equal(new URL(dom.window.location.href).searchParams.has('view'), false);
    assert.equal(editorStatus().textContent, 'In sync with the form.');
  });

  it('honours ?type and ?view in the address', async () => {
    await start({ url: 'https://zkevinly.com/toolkit/pdf?type=service-log&view=form' });
    assert.equal(q('[data-type="service-log"]').getAttribute('aria-pressed'), 'true');
    assert.equal(q('[data-form]').hidden, false);
    assert.equal(q('[data-editor]').hidden, true);
    assert.equal(new URL(dom.window.location.href).searchParams.get('view'), 'form');
    assert.ok(q('[data-form]').children.length > 0);
  });

  it('falls back to the default type for an unknown ?type', async () => {
    await start({ url: 'https://zkevinly.com/toolkit/pdf?type=nope' });
    assert.equal(q('[data-type="invoice"]').getAttribute('aria-pressed'), 'true');
  });

  it('removes a preview service worker left by earlier versions, and only that one', async () => {
    const unregistered: string[] = [];
    const reg = (scope: string) => ({
      scope,
      unregister: async () => (unregistered.push(scope), true),
    });
    await start({
      before: () =>
        Object.defineProperty(dom.window.navigator, 'serviceWorker', {
          configurable: true,
          value: {
            getRegistrations: async () => [
              reg('https://zkevinly.com/toolkit/pdf/preview/'),
              reg('https://zkevinly.com/'),
            ],
          },
        }),
    });
    await settle();
    assert.deepEqual(unregistered, ['https://zkevinly.com/toolkit/pdf/preview/']);
  });

  it('survives a service-worker lookup that fails', async () => {
    await start({
      before: () =>
        Object.defineProperty(dom.window.navigator, 'serviceWorker', {
          configurable: true,
          value: { getRegistrations: async () => Promise.reject(new Error('denied')) },
        }),
    });
    await settle();
    assert.equal(JSON.parse(editorText().value).type, 'invoice');
  });

  it('ignores a submitted form', async () => {
    await start();
    const submit = new dom.window.Event('submit', { cancelable: true });
    q('[data-form]').dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, true);
  });
});

describe('switching type and view', () => {
  it('shows another type, clears the status, and ignores the current or unknown ones', async () => {
    await start();
    click(action('json'));
    assert.notEqual(status().textContent, '');
    click(q('[data-type="invoice"]'));
    assert.notEqual(status().textContent, '', 'same type: nothing happens');
    click(q('[data-type="bogus"]'));
    assert.equal(q('[data-type="invoice"]').getAttribute('aria-pressed'), 'true');
    click(q('[data-type="service-log"]'));
    assert.equal(status().textContent, '');
    assert.equal(q('[data-type="service-log"]').getAttribute('aria-pressed'), 'true');
    assert.equal(JSON.parse(editorText().value).type, 'service-log');
    assert.equal(new URL(dom.window.location.href).searchParams.get('type'), 'service-log');
  });

  it('flips between the JSON editor and the form, focusing the editor', async () => {
    await start();
    click(q('[data-view="form"]'));
    assert.equal(q('[data-form]').hidden, false);
    assert.equal(q('[data-editor]').hidden, true);
    assert.equal(new URL(dom.window.location.href).searchParams.get('view'), 'form');
    click(q('[data-view="json"]'));
    assert.equal(q('[data-editor]').hidden, false);
    assert.equal(dom.document.activeElement, editorText());
    assert.equal(new URL(dom.window.location.href).searchParams.has('view'), false);
  });

  it('typing in the form shows up in the JSON', async () => {
    await start();
    makeDirty();
    click(q('[data-view="json"]'));
    assert.match(editorText().value, /changed/);
  });

  it('a type with no example hides the example button and ignores it', async () => {
    await start();
    const custom = getType('custom')!;
    const saved = custom.example;
    (custom as { example?: unknown }).example = undefined;
    try {
      click(q('[data-type="custom"]'));
      assert.equal(action('example').hidden, true);
      click(action('example'));
      assert.equal(status().textContent, '');
    } finally {
      (custom as { example?: unknown }).example = saved;
    }
  });
});

describe('the JSON editor', () => {
  it('applies valid JSON after a pause: switches type, updates status, marks it unsaved', async () => {
    await start();
    input(editorText(), jsonOf(getType('custom')!));
    assert.equal(
      editorStatus().textContent,
      'In sync with the form.',
      'nothing yet: it waits for a pause',
    );
    tick(300);
    assert.equal(editorStatus().dataset.kind, 'ok');
    assert.match(editorStatus().textContent!, /^Valid custom/);
    assert.equal(q('[data-type="custom"]').getAttribute('aria-pressed'), 'true');
    const leaving = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(leaving);
    assert.equal(leaving.defaultPrevented, true);
  });

  it('accepts just the data for the type being edited', async () => {
    await start();
    input(editorText(), JSON.stringify({ notes: 'plain data' }));
    tick(300);
    assert.equal(editorStatus().dataset.kind, 'ok');
    assert.match(editorStatus().textContent!, /^Valid invoice/);
  });

  it('says what is wrong with broken JSON, or a wrong envelope, and keeps the text', async () => {
    await start();
    input(editorText(), '{ not json');
    tick(300);
    assert.equal(editorStatus().dataset.kind, 'error');
    assert.equal(editorText().value, '{ not json');
    input(
      editorText(),
      JSON.stringify({ schema: 'toolkit.pdf', version: 1, type: 'zzz', data: {} }),
    );
    tick(300);
    assert.equal(editorStatus().dataset.kind, 'error');
    assert.match(editorStatus().textContent!, /\S/);
  });

  it('tidies valid text when you leave the box, applying a pending change at once', async () => {
    await start();
    input(editorText(), JSON.stringify({ notes: 'quick' }));
    editorText().dispatchEvent(new dom.window.Event('blur'));
    assert.equal(editorStatus().textContent, 'In sync with the form.');
    const tidy = JSON.parse(editorText().value);
    assert.equal(tidy.schema, 'toolkit.pdf');
    assert.equal(tidy.data.notes, 'quick', 'the pending edit was applied, not lost');
    tick(300); // the cancelled timer must not fire a second time
    assert.equal(JSON.parse(editorText().value).schema, 'toolkit.pdf');
  });

  it('leaves invalid text alone on blur, and tidies when nothing is pending', async () => {
    await start();
    input(editorText(), '{ broken');
    editorText().dispatchEvent(new dom.window.Event('blur'));
    assert.equal(editorText().value, '{ broken');
    editorText().value = JSON.stringify({ notes: 'x' });
    editorText().dispatchEvent(new dom.window.Event('blur'));
    assert.equal(JSON.parse(editorText().value).schema, 'toolkit.pdf');
  });

  it('Format rewrites valid JSON the way the tool saves it, and reports invalid JSON', async () => {
    await start();
    editorText().value = '{"notes":"compact"}';
    click(action('editor-format'));
    assert.ok(editorText().value.includes('\n'));
    assert.equal(JSON.parse(editorText().value).type, 'invoice');
    editorText().value = '[';
    click(action('editor-format'));
    assert.equal(editorStatus().dataset.kind, 'error');
    assert.equal(editorText().value, '[');
  });

  it('does not rewrite the text while you are typing in it', async () => {
    await start();
    editorText().focus();
    editorText().value = '{"notes":"mid-edit"}';
    click(q('[data-type="custom"]'));
    assert.equal(editorText().value, '{"notes":"mid-edit"}');
  });
});

describe('the live preview', () => {
  const settled = async (frame: number) => {
    tick(350);
    await waitFor(() => hasBlobSrc(frames()[frame]), `preview in frame ${frame}`);
  };

  it('builds the PDF after a pause into the hidden frame, then brings it forward', async () => {
    await start();
    click(action('example'));
    await settled(1);
    assert.match(frames()[1].src, /^blob:.*#navpanes=0&view=FitH$/);
    assert.equal(frames()[0].dataset.front, 'true', 'not swapped yet');
    tick(2000);
    assert.equal(frames()[1].dataset.front, 'true');
    assert.equal(frames()[1].hasAttribute('inert'), false);
    assert.equal(frames()[1].hasAttribute('aria-hidden'), false);
    assert.equal(frames()[1].hasAttribute('tabindex'), false);
    assert.equal(frames()[0].dataset.front, 'false');
    assert.equal(frames()[0].hasAttribute('inert'), true);
    assert.equal(frames()[0].getAttribute('aria-hidden'), 'true');
    assert.equal(frames()[0].getAttribute('tabindex'), '-1');
    assert.equal(q('[data-preview-open]').hidden, false);
    assert.equal(q('[data-preview-note]').hidden, true);
  });

  it('swaps after the viewer reports it loaded, and the fallback timer then does nothing', async () => {
    await start();
    click(action('example'));
    await settled(1);
    frames()[1].dispatchEvent(new dom.window.Event('load'));
    tick(350);
    assert.equal(frames()[1].dataset.front, 'true');
    tick(2000);
    assert.equal(frames()[1].dataset.front, 'true');
  });

  it('a late load event after the fallback already swapped changes nothing', async () => {
    await start();
    click(action('example'));
    await settled(1);
    tick(2000);
    frames()[1].dispatchEvent(new dom.window.Event('load'));
    tick(350);
    assert.equal(frames()[1].dataset.front, 'true');
    assert.equal(revoked.length, 0);
  });

  it('frees the previous preview when the next one arrives', async () => {
    await start();
    click(action('example'));
    await settled(1);
    tick(2000);
    const first = frames()[1].src.split('#')[0];
    input(q<HTMLTextAreaElement>('[data-editor-text]'), JSON.stringify({ notes: 'again' }));
    tick(300);
    await settled(0);
    tick(2000);
    assert.ok(revoked.includes(first));
  });

  it('drops a build that a newer edit has already replaced', async () => {
    await start();
    click(action('example'));
    tick(350); // build 1 starts…
    click(action('new')); // …and an edit lands while it is still running
    tick(350); // build 2 starts
    await waitFor(() => hasBlobSrc(frames()[1]), 'the newer preview');
    await settle(20);
    assert.equal(frames().filter(hasBlobSrc).length, 1, 'only the newer build reached a frame');
  });

  it('frees a preview that a newer edit overtook while it was still loading', async () => {
    await start();
    click(action('example'));
    await settled(1);
    const overtaken = frames()[1].src.split('#')[0];
    click(action('new'));
    tick(350); // a newer build begins while the first sits in the hidden frame
    tick(2000); // the first one's fallback timer fires: it has been superseded
    assert.ok(revoked.includes(overtaken));
    assert.equal(frames()[0].dataset.front, 'true', 'the stale preview was never brought forward');
  });

  it('shows what is wrong with the document next to the preview', async () => {
    await start();
    withProblem();
    tick(350);
    await waitFor(() => hasBlobSrc(frames()[1]), 'preview');
    await waitFor(() => !q('[data-preview-note]').hidden, 'the note');
    assert.match(q('[data-preview-note]').textContent!, /Line 1: Qty is not a number/);
  });

  it('reports a build failure instead of a preview, in words or by default', async () => {
    await start();
    const invoice = getType('invoice')!;
    const layout = invoice.layout;
    try {
      invoice.layout = () => {
        throw new Error('layout broke');
      };
      click(action('new'));
      tick(350);
      await waitFor(() => !q('[data-preview-note]').hidden, 'error note');
      assert.equal(q('[data-preview-note]').textContent, 'layout broke');
      invoice.layout = () => {
        throw 'not an Error object';
      };
      click(action('new'));
      tick(350);
      await waitFor(
        () => q('[data-preview-note]').textContent === 'Preview unavailable.',
        'fallback note',
      );
    } finally {
      invoice.layout = layout;
    }
  });

  it('"Open preview in a new tab" opens the current preview without giving it the opener', async () => {
    await start();
    click(q('[data-preview-open]'));
    assert.equal(opened.length, 0, 'nothing to open yet');
    click(action('example'));
    await settled(1);
    tick(2000);
    click(q('[data-preview-open]'));
    assert.equal(opened.length, 1);
    assert.match(String(opened[0][0]), /^blob:/);
    assert.deepEqual(opened[0].slice(1), ['_blank', 'noopener']);
  });
});

describe('downloads', () => {
  const read = async (href: string) => Buffer.from(await resolveObjectURL(href)!.arrayBuffer());

  it('Download PDF saves a real PDF named from the document, and says so', async () => {
    await start();
    click(action('example'));
    click(action('pdf'));
    await waitFor(() => downloads.length === 1, 'the download');
    assert.match(downloads[0].name, /\.pdf$/);
    assert.equal((await read(downloads[0].href)).subarray(0, 5).toString(), '%PDF-');
    assert.equal(status().dataset.kind, 'ok');
    assert.match(status().textContent!, /^PDF downloaded\. Keep it/);
    tick(10_000);
    assert.ok(revoked.includes(downloads[0].href), 'the temporary link is freed afterwards');
    assert.equal(dom.document.querySelector('a[download]'), null, 'the helper link is removed');
  });

  it('warns when the document has problems but still saves it', async () => {
    await start();
    withProblem();
    click(action('pdf'));
    await waitFor(() => downloads.length === 1, 'the download');
    assert.equal(status().dataset.kind, 'warn');
    assert.match(status().textContent!, /^PDF downloaded, but: .*Qty is not a number/);
  });

  it('reports a failure to build, with the reason or a default', async () => {
    await start();
    const invoice = getType('invoice')!;
    const layout = invoice.layout;
    try {
      invoice.layout = () => {
        throw new Error('no can do');
      };
      click(action('pdf'));
      await waitFor(() => status().dataset.kind === 'error', 'error status');
      assert.equal(status().textContent, 'no can do');
      invoice.layout = () => {
        throw 42;
      };
      click(action('pdf'));
      await waitFor(() => status().textContent === 'Could not create the PDF.', 'default message');
      assert.equal(downloads.length, 0);
    } finally {
      invoice.layout = layout;
    }
  });

  it('Export JSON saves the same envelope the editor shows', async () => {
    await start();
    click(action('example'));
    click(action('json'));
    assert.equal(downloads.length, 1);
    assert.match(downloads[0].name, /\.json$/);
    const saved = JSON.parse((await read(downloads[0].href)).toString());
    assert.deepEqual(saved, JSON.parse(editorText().value));
    assert.equal(status().textContent, 'JSON downloaded.');
    const leaving = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(leaving);
    assert.equal(leaving.defaultPrevented, false, 'saved work is no longer unsaved');
  });

  it('Ctrl/Cmd+S downloads the PDF instead of the browser’s save dialog', async () => {
    await start();
    const press = (init: KeyboardEventInit) => {
      const event = new dom.window.KeyboardEvent('keydown', {
        cancelable: true,
        bubbles: true,
        ...init,
      });
      dom.window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    assert.equal(press({ key: 's', ctrlKey: true }), true);
    assert.equal(press({ key: 'S', metaKey: true }), true);
    assert.equal(press({ key: 's' }), false);
    assert.equal(press({ key: 's', ctrlKey: true, shiftKey: true }), false);
    assert.equal(press({ key: 'x', ctrlKey: true }), false);
    await waitFor(() => downloads.length === 2, 'two downloads');
  });
});

describe('opening a saved file', () => {
  const pdfFile = async () => {
    const type = getType('service-log')!;
    const { bytes } = await buildPdf(type, newDoc(type));
    return new File([bytes as BlobPart], 'log.pdf', { type: 'application/pdf' });
  };

  it('the button opens the file chooser', async () => {
    await start();
    const spy = mock.method(fileInput(), 'click', () => {});
    click(action('load'));
    assert.equal(spy.mock.callCount(), 1);
  });

  it('loads a JSON file and switches to its type', async () => {
    await start();
    choose(new File([jsonOf(getType('custom')!)], 'mine.json'));
    await waitFor(() => status().dataset.kind === 'ok', 'load');
    assert.equal(status().textContent, 'Loaded a custom document from mine.json.');
    assert.equal(q('[data-type="custom"]').getAttribute('aria-pressed'), 'true');
    assert.equal(fileInput().value, '');
  });

  it('recognises JSON by its type as well as its name', async () => {
    await start();
    choose(new File([jsonOf(getType('custom')!)], 'export.txt', { type: 'application/json' }));
    await waitFor(() => status().dataset.kind === 'ok', 'load');
  });

  it('loads a PDF made by the tool', async () => {
    await start();
    choose(await pdfFile());
    await waitFor(() => status().dataset.kind === 'ok', 'load');
    assert.equal(q('[data-type="service-log"]').getAttribute('aria-pressed'), 'true');
  });

  it('says why a file cannot be used', async () => {
    await start();
    choose(new File(['just text'], 'notes.pdf'));
    await waitFor(() => status().dataset.kind === 'error', 'error');
    assert.match(status().textContent!, /\S/);
    choose({
      size: 5,
      name: 'weird.pdf',
      type: '',
      arrayBuffer: async () => Promise.reject(new Error('disk')),
    });
    await waitFor(
      () => status().textContent === 'That file could not be read by this tool.',
      'generic error',
    );
  });

  it('refuses files over 25 MB before reading them', async () => {
    await start();
    choose({
      size: 26 * 1024 * 1024,
      name: 'huge.pdf',
      type: '',
      arrayBuffer: async () => assert.fail('read it'),
    });
    await waitFor(() => status().dataset.kind === 'error', 'error');
    assert.match(status().textContent!, /too large/);
  });

  it('ignores an empty selection', async () => {
    await start();
    choose(null);
    await settle();
    assert.equal(status().textContent, '');
  });

  it('asks before replacing unsaved work, and respects "cancel"', async () => {
    await start();
    makeDirty();
    confirmAnswer = false;
    choose(new File([jsonOf(getType('custom')!)], 'mine.json'));
    await settle();
    assert.equal(confirms.length, 1);
    assert.equal(q('[data-type="invoice"]').getAttribute('aria-pressed'), 'true');
    confirmAnswer = true;
    choose(new File([jsonOf(getType('custom')!)], 'mine.json'));
    await waitFor(() => status().dataset.kind === 'ok', 'load');
    assert.equal(q('[data-type="custom"]').getAttribute('aria-pressed'), 'true');
  });

  it('does not ask when there is nothing unsaved', async () => {
    await start();
    choose(new File([jsonOf(getType('custom')!)], 'mine.json'));
    await waitFor(() => status().dataset.kind === 'ok', 'load');
    assert.deepEqual(confirms, []);
  });
});

describe('starting over and the example', () => {
  it('Start over asks first when there is unsaved work', async () => {
    await start();
    makeDirty();
    confirmAnswer = false;
    click(action('new'));
    assert.equal(confirms.length, 1);
    assert.match(confirms[0], /^Start a new invoice\?/);
    assert.equal(status().textContent, '');
    confirmAnswer = true;
    click(action('new'));
    assert.equal(status().textContent, 'Started a new invoice.');
    click(q('[data-view="json"]'));
    assert.doesNotMatch(editorText().value, /changed/);
  });

  it('Fill with an example replaces the document, after asking when needed', async () => {
    await start();
    makeDirty();
    confirmAnswer = false;
    click(action('example'));
    assert.equal(status().textContent, '');
    confirmAnswer = true;
    click(action('example'));
    assert.equal(status().textContent, 'Loaded the example.');
    click(q('[data-view="json"]'));
    assert.match(editorText().value, /Acme Studio/);
    assert.equal(confirms.length, 2);
  });
});

describe('drag and drop', () => {
  const drag = (type: string, dataTransfer?: unknown) => {
    const event = new dom.window.Event(type, { cancelable: true });
    if (dataTransfer !== undefined)
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    dom.window.dispatchEvent(event);
    return event;
  };
  const files = (...list: unknown[]) => ({ types: ['Files'], files: list });

  it('shows the drop zone while files are dragged over, and hides it when they leave', async () => {
    await start();
    drag('dragenter', files());
    drag('dragenter', files());
    assert.equal(q('[data-drop-overlay]').hidden, false);
    drag('dragleave');
    assert.equal(q('[data-drop-overlay]').hidden, false, 'still inside a child element');
    drag('dragleave');
    assert.equal(q('[data-drop-overlay]').hidden, true);
    drag('dragleave');
    assert.equal(q('[data-drop-overlay]').hidden, true, 'never counts below zero');
  });

  it('ignores drags that are not files', async () => {
    await start();
    drag('dragenter', { types: ['text/plain'] });
    drag('dragenter');
    assert.equal(q('[data-drop-overlay]').hidden, true);
    assert.equal(drag('dragover', { types: ['text/plain'] }).defaultPrevented, false);
    assert.equal(drag('drop', { types: ['text/plain'] }).defaultPrevented, false);
    assert.equal(drag('dragover', files()).defaultPrevented, true, 'files may be dropped here');
  });

  it('dropping a file loads it and clears the drop zone', async () => {
    await start();
    drag('dragenter', files());
    const dropped = drag('drop', files(new File([jsonOf(getType('custom')!)], 'dropped.json')));
    assert.equal(dropped.defaultPrevented, true);
    assert.equal(q('[data-drop-overlay]').hidden, true);
    await waitFor(() => status().dataset.kind === 'ok', 'load');
    assert.equal(status().textContent, 'Loaded a custom document from dropped.json.');
  });

  it('dropping nothing usable does not load anything', async () => {
    await start();
    drag('drop', files());
    await settle();
    assert.equal(status().textContent, '');
  });
});

describe('protecting unsaved work', () => {
  it('asks the browser to confirm closing the tab only when there are unsaved edits', async () => {
    await start();
    const quiet = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(quiet);
    assert.equal(quiet.defaultPrevented, false);
    makeDirty();
    const loud = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(loud);
    assert.equal(loud.defaultPrevented, true);
  });

  describe('leaving through a link', () => {
    const link = (attrs: string) => {
      dom.document.body.insertAdjacentHTML(
        'beforeend',
        `<a id="go" ${attrs}>go</a><p id="para">text</p>`,
      );
      return q('#go');
    };
    const follow = (el: Element) => {
      const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event;
    };

    it('asks before following a link to another page; "cancel" stays put', async () => {
      await start();
      makeDirty();
      confirmAnswer = false;
      const event = follow(link('href="/about"'));
      assert.equal(confirms.length, 1);
      assert.equal(event.defaultPrevented, true);
      confirmAnswer = true;
      const allowed = follow(q('#go'));
      assert.equal(confirms.length, 2);
      assert.equal(allowed.defaultPrevented, false);
      const leaving = new dom.window.Event('beforeunload', { cancelable: true });
      dom.window.dispatchEvent(leaving);
      assert.equal(
        leaving.defaultPrevented,
        false,
        'already confirmed: no second prompt from the browser',
      );
    });

    it('stays quiet when nothing is unsaved', async () => {
      await start();
      follow(link('href="/about"'));
      assert.deepEqual(confirms, []);
    });

    it('does not interfere with links that keep you here or open elsewhere', async () => {
      await start();
      makeDirty();
      for (const attrs of [
        'href="/toolkit/pdf#section"',
        'href="https://example.com/x"',
        'href="/about" target="_blank"',
        'href="/file.pdf" download',
      ]) {
        dom.document.querySelector('#go')?.remove();
        follow(link(attrs));
      }
      assert.deepEqual(confirms, []);
    });

    it('ignores clicks that are not on links, and clicks something else already handled', async () => {
      await start();
      makeDirty();
      follow(link('href="/about"').nextElementSibling!);
      assert.deepEqual(confirms, []);
      const handled = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
      // The window sees a capturing click before the document does: something got there first.
      dom.window.addEventListener('click', (e) => e.preventDefault(), { capture: true });
      q('#go').dispatchEvent(handled);
      assert.deepEqual(confirms, []);
    });
  });
});

describe('leaving the page', () => {
  it('tears everything down before the page swaps', async () => {
    await start();
    click(action('example'));
    await (async () => {
      tick(350);
      await waitFor(() => hasBlobSrc(frames()[1]), 'preview');
    })();
    tick(2000);
    const live = frames()[1].src.split('#')[0];
    dom.document.dispatchEvent(new dom.window.Event('astro:before-swap'));
    assert.ok(revoked.includes(live), 'the preview is freed');
    const press = new dom.window.KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      cancelable: true,
    });
    dom.window.dispatchEvent(press);
    assert.equal(press.defaultPrevented, false, 'its listeners are gone');
    click(action('json'));
    assert.equal(downloads.length, 0);
  });
});
