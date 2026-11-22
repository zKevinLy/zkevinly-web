// Browser-side: paints a Node's ping indicator (`.node-ping`). The UI knows how to show a result;
// how to get one (a Worker endpoint, a request from the visitor's own browser) is the app's business.

export type PingState = 'pending' | 'up' | 'down' | 'unknown';

/** One check: reachable or not, and how long the answer took. */
export interface PingResult {
  up: boolean;
  /** Round-trip time in milliseconds, when known. */
  ms?: number;
}

/** A result, or why there isn't one yet (`pending`: still checking, `unknown`: the check itself failed). */
export type PingInput = PingResult | 'pending' | 'unknown';

export interface PingView {
  state: PingState;
  /** Short text beside the dot ("12 ms", "Down"); empty when there is nothing to say. */
  text: string;
  /** Screen-reader / tooltip text. */
  label: string;
}

export function pingView(input: PingInput): PingView {
  if (input === 'pending') return { state: 'pending', text: '', label: 'Status: checking' };
  if (input === 'unknown') return { state: 'unknown', text: '', label: 'Status unavailable' };
  if (!input.up) return { state: 'down', text: 'Down', label: 'Status: down' };

  const ms =
    typeof input.ms === 'number' && Number.isFinite(input.ms)
      ? Math.max(0, Math.round(input.ms))
      : undefined;
  return ms === undefined
    ? { state: 'up', text: 'Up', label: 'Status: up' }
    : { state: 'up', text: `${ms} ms`, label: `Status: up, ${ms} ms` };
}

/** Updates one `.node-ping` element. */
export function applyPing(el: HTMLElement, input: PingInput) {
  const view = pingView(input);
  el.dataset.state = view.state;
  el.setAttribute('aria-label', view.label);
  el.title = view.label;

  const text = el.querySelector<HTMLElement>('.node-ping-text');
  if (text) {
    text.textContent = view.text;
    text.hidden = view.text === '';
  }
}
