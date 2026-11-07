import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { remoteScriptUrl } from '../../src/lib/commands';

describe('remoteScriptUrl', () => {
  it('detects PowerShell download-and-run one-liners', () => {
    assert.equal(
      remoteScriptUrl('irm https://get.activated.win | iex'),
      'https://get.activated.win',
    );
    assert.equal(
      remoteScriptUrl('iwr -useb https://christitus.com/win | iex'),
      'https://christitus.com/win',
    );
    assert.equal(
      remoteScriptUrl('Invoke-RestMethod https://example.com/a.ps1 | Invoke-Expression'),
      'https://example.com/a.ps1',
    );
  });

  it('detects curl/wget piped into a shell', () => {
    assert.equal(remoteScriptUrl('curl -fsSL https://example.com/install.sh | sh'), 'https://example.com/install.sh');
    assert.equal(remoteScriptUrl('wget -qO- https://example.com/i.sh | bash'), 'https://example.com/i.sh');
    assert.equal(remoteScriptUrl('curl https://example.com/i.sh | sudo bash'), null, 'sudo is not a runner');
  });

  it('is case-insensitive', () => {
    assert.equal(remoteScriptUrl('IRM https://example.com/x | IEX'), 'https://example.com/x');
  });

  it('handles quoted URLs without swallowing the quote', () => {
    assert.equal(remoteScriptUrl(`irm "https://example.com/x" | iex`), 'https://example.com/x');
    assert.equal(remoteScriptUrl(`curl 'https://example.com/x' | sh`), 'https://example.com/x');
  });

  it('returns null for commands that do not pipe into a shell', () => {
    assert.equal(remoteScriptUrl('winget install Git.Git'), null);
    assert.equal(remoteScriptUrl('curl -O https://example.com/file.zip'), null);
    assert.equal(remoteScriptUrl('irm https://example.com/data.json | ConvertFrom-Json'), null);
    assert.equal(remoteScriptUrl(''), null);
  });
});
