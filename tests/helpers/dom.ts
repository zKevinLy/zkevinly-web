import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * A real DOM for the browser-side modules. Installs jsdom's window as the global one, the way a
 * page has it, and puts everything back afterwards.
 *
 * Deliberately kept from Node, not jsdom: URL, Blob, File and fetch. (Node's URL.createObjectURL
 * and Blob work together, and jsdom's File lacks .text()/.arrayBuffer().)
 *
 * Timers on `window` call whatever `globalThis.setTimeout` is *at call time*, so
 * `mock.timers.enable()` controls the page's timers too.
 */
const GLOBALS = [
  'window',
  'document',
  'location',
  'history',
  'navigator',
  'localStorage',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'AbortController',
  'AbortSignal',
] as const;

export interface Dom {
  window: Window & typeof globalThis;
  document: Document;
  restore(): void;
}

export function installDom(
  html = '<!doctype html><html><body></body></html>',
  url = 'https://zkevinly.com/',
): Dom {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    // jsdom reports unimplemented browser features (like following a link) on its virtual
    // console. Nothing is forwarded, so those stay quiet.
    virtualConsole: new VirtualConsole(),
  });
  const window = dom.window as unknown as Window & typeof globalThis;

  const timers = window as unknown as Record<string, unknown>;
  timers.setTimeout = (fn: () => void, ms?: number, ...args: unknown[]) =>
    globalThis.setTimeout(fn, ms, ...args);
  timers.clearTimeout = (id?: NodeJS.Timeout) => globalThis.clearTimeout(id);
  timers.setInterval = (fn: () => void, ms?: number, ...args: unknown[]) =>
    globalThis.setInterval(fn, ms, ...args);
  timers.clearInterval = (id?: NodeJS.Timeout) => globalThis.clearInterval(id);

  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const name of GLOBALS) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === 'window' ? window : (window as unknown as Record<string, unknown>)[name],
    });
  }

  return {
    window,
    document: window.document,
    restore() {
      for (const name of GLOBALS) {
        const original = saved.get(name);
        if (original) Object.defineProperty(globalThis, name, original);
        else delete (globalThis as Record<string, unknown>)[name];
      }
      window.close();
    },
  };
}

/** Lets pending promises and zero-delay callbacks run (setImmediate is never mocked). */
export const settle = async (rounds = 5) => {
  for (let i = 0; i < rounds; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

/** Polls until `check` is true (real time, so real async work such as building a PDF can finish). */
export async function waitFor(check: () => boolean, what = 'condition', ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
