// Helpers for click-to-copy shell commands. Keep this file free of Node-only APIs.

const FETCHERS = String.raw`(?:irm|iwr|invoke-restmethod|invoke-webrequest|curl|wget)`;
const RUNNERS = String.raw`(?:iex|invoke-expression|sh|bash|zsh|pwsh|powershell)`;
const REMOTE_SCRIPT = new RegExp(
  String.raw`\b${FETCHERS}\b[^|]*?(https?:\/\/[^\s|'")]+)[^|]*\|\s*${RUNNERS}\b`,
  'i',
);

/**
 * If the command downloads a script and pipes it straight into a shell
 * (`irm … | iex`, `curl … | sh`), returns the script's URL so the card can let
 * people read it first. Browsers/extensions such as uBlock Origin flag this
 * exact pattern when it's written to the clipboard ("ClickFix" protection).
 */
export function remoteScriptUrl(command: string): string | null {
  return REMOTE_SCRIPT.exec(command)?.[1] ?? null;
}
