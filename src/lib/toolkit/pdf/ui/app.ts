// Browser wiring for the PDF tool page. State lives in memory only: nothing is written to
// localStorage, sessionStorage, IndexedDB or cookies, so closing the tab leaves no trace.
// The PDF/JSON files you download are the persistence.
//
// Each document type keeps its own in-progress data for the life of the tab, so switching
// types never loses work.
//
// The side preview is a blob: URL, so it never touches the network. (A service worker used
// to serve it from a named URL, but the browser's PDF viewer re-requests that URL itself when
// you press its Download button, bypassing the worker, so it saved the site's HTML instead.)

import type { AnyDocType } from '../doctype';
import {
  buildPdf,
  extractPdf,
  newDoc,
  parseDoc,
  parseEnvelope,
  parseJsonText,
  serialize,
  validateDoc,
  type Loaded,
} from '../engine';
import { DocError } from '../errors';
import { isObj, type Data } from '../schema';
import { DEFAULT_TYPE, getType } from '../types';
import { renderForm, type FormHandle } from './form';

/** The message of a thrown Error, or a fallback for anything else that was thrown. */
const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PAINT_DELAY_MS = 350;

type Status = 'info' | 'ok' | 'warn' | 'error';
type View = 'json' | 'form';

function download(bytes: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Earlier versions registered a preview service worker. Remove it for returning visitors;
 * a leftover worker would keep answering /toolkit/pdf/preview/ requests.
 */
function removeLegacyPreviewWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter((r) => new URL(r.scope).pathname.startsWith('/toolkit/pdf/preview'))
          .map((r) => r.unregister()),
      ),
    )
    .catch(() => undefined);
}

export function initPdfTool(): void {
  const root = document.querySelector<HTMLElement>('[data-pdf-tool]');
  if (!root) return;

  removeLegacyPreviewWorker();

  const abort = new AbortController();
  const { signal } = abort;
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

  const form = $<HTMLFormElement>('[data-form]');
  const statusEl = $<HTMLElement>('[data-status]');
  const blurb = $<HTMLElement>('[data-type-blurb]');
  const frames = [...root.querySelectorAll<HTMLIFrameElement>('[data-preview]')];
  const previewNote = $<HTMLElement>('[data-preview-note]');
  const previewOpen = $<HTMLButtonElement>('[data-preview-open]');
  const dropOverlay = $<HTMLElement>('[data-drop-overlay]');
  const fileInput = $<HTMLInputElement>('[data-file-input]');
  const exampleButton = $<HTMLButtonElement>('[data-action="example"]');
  const editor = $<HTMLElement>('[data-editor]');
  const editorText = $<HTMLTextAreaElement>('[data-editor-text]');
  const editorStatus = $<HTMLElement>('[data-editor-status]');
  const viewButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const typeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-type]')];

  const docs = new Map<string, Data>();
  let current: AnyDocType;
  let handle: FormHandle;
  let dirty = false;
  let previewUrl: string | undefined;
  let previewTimer: number | undefined;
  let previewRun = 0;
  /** Index of the frame currently shown; the other one loads the next version off-screen. */
  let front = 0;

  const setStatus = (message: string, kind: Status = 'info') => {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
  };

  const dataOf = (): Data => docs.get(current.id)!;

  // ---- JSON editor --------------------------------------------------------------------------
  // A live view of the config embedded in the PDF. Typing valid JSON updates the form and
  // preview; editing the form rewrites the text (except while you are typing in it).

  let editorTimer: number | undefined;

  const setEditorStatus = (message: string, kind: Status) => {
    editorStatus.textContent = message;
    editorStatus.dataset.kind = kind;
  };

  function syncEditor(force = false): void {
    if (editor.hidden) return;
    if (!force && document.activeElement === editorText) return;
    editorText.value = serialize(current, dataOf());
    setEditorStatus('In sync with the form.', 'info');
  }

  /** Full envelope, or bare data for the type being edited. */
  function parseEditorText(text: string): Loaded {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new DocError(messageOf(error, 'Not valid JSON.'));
    }
    if (isObj(parsed) && !('schema' in parsed)) {
      return { type: current, data: parseDoc(current, parsed) };
    }
    return parseEnvelope(parsed);
  }

  function applyEditorText(): void {
    try {
      const loaded = parseEditorText(editorText.value);
      docs.set(loaded.type.id, loaded.data);
      show(loaded.type);
      dirty = true;
      setEditorStatus(
        `Valid ${loaded.type.label.toLowerCase()}. The form and preview are updated.`,
        'ok',
      );
    } catch (error) {
      setEditorStatus(messageOf(error, 'Not valid.'), 'error');
    }
  }

  /** JSON is the default view; the form is the same data as inputs. Both stay in sync. */
  function setView(next: View, focus = false): void {
    editor.hidden = next !== 'json';
    form.hidden = next !== 'form';
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view === next));
    }
    if (next === 'json') {
      syncEditor(true);
      if (focus) editorText.focus();
    }
    const url = new URL(location.href);
    if (next === 'json') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    history.replaceState(history.state, '', url);
  }

  // ---- Type switching -----------------------------------------------------------------------

  function show(type: AnyDocType): void {
    current = type;
    if (!docs.has(type.id)) docs.set(type.id, newDoc(type));
    handle = renderForm(form, type.fields, dataOf(), onChange);

    for (const button of typeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.type === type.id));
    }
    blurb.textContent = type.description;
    exampleButton.hidden = !type.example;

    const url = new URL(location.href);
    url.searchParams.set('type', type.id);
    history.replaceState(history.state, '', url);

    refresh();
  }

  // ---- Live values and preview --------------------------------------------------------------

  function refresh(): void {
    handle.setLive(current.live?.(dataOf()) ?? {});
    syncEditor();
    schedulePreview();
  }

  function onChange(): void {
    dirty = true;
    refresh();
  }

  function previewUrlFor(bytes: Uint8Array): string {
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  }

  const release = (url: string | undefined) => {
    if (url) URL.revokeObjectURL(url);
  };

  /** The visible frame is focusable and announced; the one loading behind it is neither. */
  function setFrameRole(frame: HTMLIFrameElement, isFront: boolean): void {
    frame.dataset.front = String(isFront);
    frame.toggleAttribute('inert', !isFront);
    if (isFront) {
      frame.removeAttribute('aria-hidden');
      frame.removeAttribute('tabindex');
    } else {
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
    }
  }

  /**
   * Loads the new PDF into the hidden frame and only swaps it to the front once it has
   * painted underneath, so the visible preview never goes blank between edits.
   */
  function swapIn(url: string, run: number): void {
    const back = frames[1 - front];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      if (run !== previewRun) {
        release(url); // a newer edit superseded this one
        return;
      }
      setFrameRole(frames[front], false);
      setFrameRole(back, true);
      front = 1 - front;
      release(previewUrl);
      previewUrl = url;
      previewOpen.hidden = false;
    };
    // Some viewers never fire `load` for PDFs, so do not wait forever.
    const fallback = window.setTimeout(finish, 2000);
    // `load` fires when the viewer opens, slightly before it has painted the pages. Give it a
    // moment to draw behind the visible frame before bringing it forward.
    back.addEventListener('load', () => window.setTimeout(finish, PAINT_DELAY_MS), { once: true });
    back.src = `${url}#navpanes=0&view=FitH`;
  }

  function schedulePreview(): void {
    window.clearTimeout(previewTimer);
    const type = current;
    previewTimer = window.setTimeout(async () => {
      const run = ++previewRun;
      try {
        const data = docs.get(type.id)!;
        const { bytes, warnings } = await buildPdf(type, data);
        if (run !== previewRun) return; // a newer edit superseded this one
        swapIn(previewUrlFor(bytes), run);
        // Problems that used to appear after a download now show next to the live preview.
        const problems = [...validateDoc(type, data).map((p) => p.message), ...warnings];
        previewNote.hidden = problems.length === 0;
        previewNote.textContent = problems.join(' ');
      } catch (error) {
        previewNote.hidden = false;
        previewNote.textContent = messageOf(error, 'Preview unavailable.');
      }
    }, 350);
  }

  // ---- Downloads ----------------------------------------------------------------------------

  const fileBase = () => current.filename(parseDoc(current, dataOf()));

  async function downloadPdf(): Promise<void> {
    try {
      const { bytes, warnings } = await buildPdf(current, dataOf());
      download(bytes as BlobPart, 'application/pdf', `${fileBase()}.pdf`);
      dirty = false;
      const problems = [...validateDoc(current, dataOf()).map((p) => p.message), ...warnings];
      setStatus(
        problems.length > 0
          ? `PDF downloaded, but: ${problems.join(' ')}`
          : 'PDF downloaded. Keep it: it contains everything needed to edit this document later.',
        problems.length > 0 ? 'warn' : 'ok',
      );
    } catch (error) {
      setStatus(messageOf(error, 'Could not create the PDF.'), 'error');
    }
  }

  function downloadJson(): void {
    download(serialize(current, dataOf()), 'application/json', `${fileBase()}.json`);
    dirty = false;
    setStatus('JSON downloaded.', 'ok');
  }

  // ---- Loading a PDF (or JSON) back in ------------------------------------------------------

  const confirmReplace = (question: string) => !dirty || window.confirm(question);

  function open(loaded: Loaded): void {
    docs.set(loaded.type.id, loaded.data);
    show(loaded.type);
    dirty = false;
  }

  async function loadFile(file: File): Promise<void> {
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus('That file is too large (limit 25 MB).', 'error');
      return;
    }
    if (!confirmReplace('Replace what you are editing? Unsaved changes are lost.')) return;
    try {
      const isJson = /\.json$/i.test(file.name) || file.type === 'application/json';
      const loaded = isJson
        ? parseJsonText(await file.text())
        : await extractPdf(new Uint8Array(await file.arrayBuffer()));
      open(loaded);
      setStatus(`Loaded a ${loaded.type.label.toLowerCase()} from ${file.name}.`, 'ok');
    } catch (error) {
      setStatus(
        error instanceof DocError ? error.message : 'That file could not be read by this tool.',
        'error',
      );
    }
  }

  // ---- Events -------------------------------------------------------------------------------

  form.addEventListener('submit', (event) => event.preventDefault(), { signal });

  for (const button of typeButtons) {
    button.addEventListener(
      'click',
      () => {
        const type = getType(button.dataset.type!);
        if (type && type !== current) {
          show(type);
          setStatus('', 'info');
        }
      },
      { signal },
    );
  }

  for (const button of viewButtons) {
    button.addEventListener(
      'click',
      () => setView(button.dataset.view === 'form' ? 'form' : 'json', true),
      { signal },
    );
  }
  $('[data-action="editor-format"]').addEventListener(
    'click',
    () => {
      try {
        const loaded = parseEditorText(editorText.value);
        docs.set(loaded.type.id, loaded.data);
        show(loaded.type);
        syncEditor(true);
      } catch (error) {
        setEditorStatus(messageOf(error, 'Not valid.'), 'error');
      }
    },
    { signal },
  );
  editorText.addEventListener(
    'input',
    () => {
      window.clearTimeout(editorTimer);
      editorTimer = window.setTimeout(() => {
        editorTimer = undefined;
        applyEditorText();
      }, 300);
    },
    { signal },
  );
  // Leaving the box tidies the text to what the tool would save, if it is valid.
  editorText.addEventListener(
    'blur',
    () => {
      window.clearTimeout(editorTimer);
      if (editorTimer !== undefined) {
        editorTimer = undefined;
        applyEditorText();
      }
      try {
        parseEditorText(editorText.value);
        syncEditor(true);
      } catch {
        // Keep the invalid text so it can be fixed; the status line already says why.
      }
    },
    { signal },
  );

  // Phones often cannot show a PDF inside a page, so offer the preview in its own tab.
  previewOpen.addEventListener(
    'click',
    () => {
      if (previewUrl) window.open(previewUrl, '_blank', 'noopener');
    },
    { signal },
  );
  $('[data-action="pdf"]').addEventListener('click', downloadPdf, { signal });
  $('[data-action="json"]').addEventListener('click', downloadJson, { signal });
  $('[data-action="new"]').addEventListener(
    'click',
    () => {
      if (!confirmReplace(`Start a new ${current.label.toLowerCase()}? Unsaved changes are lost.`))
        return;
      docs.set(current.id, newDoc(current));
      show(current);
      dirty = false;
      setStatus(`Started a new ${current.label.toLowerCase()}.`, 'info');
    },
    { signal },
  );
  exampleButton.addEventListener(
    'click',
    () => {
      if (!current.example) return;
      if (
        !confirmReplace('Replace what you are editing with the example? Unsaved changes are lost.')
      )
        return;
      docs.set(current.id, parseDoc(current, current.example));
      show(current);
      dirty = false;
      setStatus('Loaded the example.', 'info');
    },
    { signal },
  );
  $('[data-action="load"]').addEventListener('click', () => fileInput.click(), { signal });
  fileInput.addEventListener(
    'change',
    () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) void loadFile(file);
    },
    { signal },
  );

  // Drop a PDF or JSON file anywhere on the page.
  let dragDepth = 0;
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
  window.addEventListener(
    'dragenter',
    (event) => {
      if (!hasFiles(event)) return;
      dragDepth++;
      dropOverlay.hidden = false;
    },
    { signal },
  );
  window.addEventListener(
    'dragleave',
    () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dropOverlay.hidden = true;
    },
    { signal },
  );
  window.addEventListener('dragover', (event) => hasFiles(event) && event.preventDefault(), {
    signal,
  });
  window.addEventListener(
    'drop',
    (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      dropOverlay.hidden = true;
      const file = event.dataTransfer?.files[0];
      if (file) void loadFile(file);
    },
    { signal },
  );

  // Nothing is stored, so closing the tab (or following a link) loses unsaved edits.
  window.addEventListener(
    'beforeunload',
    (event) => {
      if (!dirty) return;
      event.preventDefault();
    },
    { signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!dirty || event.defaultPrevented) return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (window.confirm('Leave this page? Your unsaved work will be lost.')) {
        dirty = false; // already confirmed: skip the browser's second "leave site?" prompt
      } else {
        event.preventDefault();
        event.stopPropagation(); // keep any client-side router from navigating
      }
    },
    { signal, capture: true },
  );

  // Ctrl/Cmd+S downloads the PDF instead of the browser's "save page" dialog.
  window.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void downloadPdf();
      }
    },
    { signal },
  );
  // The header persists across navigations, so tear everything down before the swap.
  document.addEventListener(
    'astro:before-swap',
    () => {
      abort.abort();
      window.clearTimeout(previewTimer);
      window.clearTimeout(editorTimer);
      release(previewUrl);
    },
    { once: true },
  );

  const requested = new URLSearchParams(location.search).get('type') ?? '';
  show(getType(requested) ?? getType(DEFAULT_TYPE)!);
  setView(new URLSearchParams(location.search).get('view') === 'form' ? 'form' : 'json');
}
