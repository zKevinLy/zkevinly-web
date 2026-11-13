import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICES,
  EMPTY_SCRIPT,
  buildInstallScript,
  installId,
  installableApps,
  isDeviceId,
  resolveApkLink,
  resolveInstallApp,
  gitlabReleaseAssets,
  selectApk,
  type InstallApp,
} from '../../src/lib/installer';
import type { Entry, TopicBlock } from '../../src/config/types';

const entry = (over: Partial<Entry> = {}): Entry => ({
  title: 'TV Bro',
  description: 'Browser',
  href: 'https://github.com/truefedex/tv-bro',
  install: {},
  ...over,
});

const github: InstallApp = {
  id: 'tv-bro',
  name: 'TV Bro',
  source: { host: 'github', path: 'truefedex/tv-bro' },
};
const gitlab: InstallApp = {
  id: 'aurora-store',
  name: 'Aurora Store',
  source: { host: 'gitlab', path: 'AuroraOSS/AuroraStore' },
};
const direct: InstallApp = {
  id: 'f-droid',
  name: 'F-Droid',
  source: { host: 'url', url: 'https://f-droid.org/F-Droid.apk' },
};

describe('installId', () => {
  it('slugs the title the same way Node anchors do', () => {
    assert.equal(installId({ title: 'Key Mapper' }), 'key-mapper');
    assert.equal(installId({ title: 'F-Droid' }), 'f-droid');
  });
});

describe('resolveInstallApp', () => {
  it('ignores entries without `install`', () => {
    assert.equal(resolveInstallApp(entry({ install: undefined })), null);
  });

  it('reads GitHub and GitLab repos from the entry', () => {
    assert.deepEqual(resolveInstallApp(entry())?.source, {
      host: 'github',
      path: 'truefedex/tv-bro',
    });
    assert.deepEqual(
      resolveInstallApp(
        entry({ title: 'Aurora', href: 'https://gitlab.com/AuroraOSS/AuroraStore/-/releases' }),
      )?.source,
      { host: 'gitlab', path: 'AuroraOSS/AuroraStore' },
    );
  });

  it('prefers a fixed APK link over the repo', () => {
    const app = resolveInstallApp(entry({ install: { url: 'https://f-droid.org/F-Droid.apk' } }));
    assert.deepEqual(app?.source, { host: 'url', url: 'https://f-droid.org/F-Droid.apk' });
  });

  it('has nowhere to download from without a repo or link', () => {
    assert.equal(resolveInstallApp(entry({ href: 'https://example.com/', repo: false })), null);
  });

  it('carries the asset filter through', () => {
    assert.equal(resolveInstallApp(entry({ install: { match: 'stable' } }))?.match, 'stable');
  });
});

describe('installableApps', () => {
  it('collects installable entries from entry blocks, in order', () => {
    const blocks: TopicBlock[] = [
      { type: 'text', content: 'hi' },
      {
        type: 'entries',
        items: [entry(), entry({ title: 'Other', install: undefined }), entry({ title: 'Two' })],
      },
    ];
    assert.deepEqual(
      installableApps(blocks).map((a) => a.id),
      ['tv-bro', 'two'],
    );
  });
});

describe('buildInstallScript', () => {
  it('explains itself when nothing is selected', () => {
    assert.equal(buildInstallScript([], 'arm64'), EMPTY_SCRIPT);
  });

  it('bakes in the chosen CPU and skips detection', () => {
    const script = buildInstallScript([github], 'arm64');
    assert.match(script, /\$abiKeys = @\('arm64\|aarch64\|v8a', 'armeabi\|armv7\|v7a'\)/);
    assert.doesNotMatch(script, /getprop/);
  });

  it('asks adb for the CPU when the device is unknown', () => {
    const script = buildInstallScript([github], 'auto');
    assert.match(script, /adb shell getprop ro\.product\.cpu\.abi/);
    assert.match(script, /switch -Wildcard/);
  });

  it('lists each selected app and only the helpers it needs', () => {
    const script = buildInstallScript([github], 'arm64');
    assert.match(script, /Name = 'TV Bro'; Find = \{ Get-GitHubApk 'truefedex\/tv-bro' \}/);
    assert.match(script, /function Get-GitHubApk/);
    assert.doesNotMatch(script, /function Get-GitLabApk/);

    const both = buildInstallScript([github, gitlab], 'arm64');
    assert.match(both, /function Get-GitLabApk/);
    assert.match(both, /Get-GitLabApk 'AuroraOSS\/AuroraStore'/);
  });

  it('needs no lookup or CPU for fixed links', () => {
    const script = buildInstallScript([direct], 'auto');
    assert.match(script, /Url = 'https:\/\/f-droid\.org\/F-Droid\.apk'/);
    assert.match(script, /Name = 'F-Droid\.apk'/);
    assert.doesNotMatch(script, /Select-Apk|abiKeys|getprop|\$headers/);
  });

  it('passes the asset filter to the lookup', () => {
    const script = buildInstallScript([{ ...github, match: 'stable' }], 'arm32');
    assert.match(script, /Get-GitHubApk 'truefedex\/tv-bro' 'stable'/);
  });

  it('escapes single quotes in names', () => {
    const script = buildInstallScript([{ ...direct, name: "Bob's App" }], 'arm64');
    assert.match(script, /Name = 'Bob''s App'/);
  });

  it('GitLab lookup also reads APK uploads linked from the release notes', () => {
    const script = buildInstallScript([gitlab], 'arm64');
    assert.match(script, /\$release\.description/);
    assert.match(script, /uploads\/\[0-9a-f\]\{32\}/);
  });

  it('GitLab file names keep their letters (the \\s escape must survive the template)', () => {
    const script = buildInstallScript([gitlab], 'arm64');
    assert.ok(script.includes('|\\s]+\', \'_\''));
    assert.doesNotMatch(script, /\|s\]\+/);
  });

  it('builds a script for every device', () => {
    for (const { id } of DEVICES) {
      assert.ok(buildInstallScript([github, gitlab, direct], id).includes('$apps = @('));
    }
  });
});

describe('isDeviceId', () => {
  it('only accepts known devices', () => {
    assert.ok(isDeviceId('arm64'));
    assert.ok(!isDeviceId('mips'));
  });
});

describe('selectApk', () => {
  const asset = (name: string) => ({ name, url: `https://x/${name}` });
  const arm64 = ['arm64|aarch64|v8a', 'armeabi|armv7|v7a'];

  it('prefers this CPU, then universal, then an older compatible build', () => {
    const pick = (names: string[]) => selectApk(names.map(asset), arm64)?.name;
    assert.equal(pick(['app-universal.apk', 'app-arm64-v8a.apk', 'app-armeabi-v7a.apk']), 'app-arm64-v8a.apk');
    assert.equal(pick(['app-x86.apk', 'app.apk', 'app-armeabi-v7a.apk']), 'app.apk');
    assert.equal(pick(['app-x86.apk', 'app-armeabi-v7a.apk']), 'app-armeabi-v7a.apk');
    assert.equal(pick(['app-x86.apk']), undefined);
  });

  it('skips non-APK files and honours the asset filter', () => {
    const assets = ['notes.txt', 'app-beta.apk', 'app-stable.apk'].map(asset);
    assert.equal(selectApk(assets, arm64, 'STABLE')?.name, 'app-stable.apk');
    assert.equal(selectApk(assets, arm64, 'nightly'), null);
  });
});

describe('gitlabReleaseAssets', () => {
  it('finds APK uploads in the release notes, absolute or relative', () => {
    const release = {
      assets: { links: [] },
      description:
        '[AuroraStore-4.8.4.apk](https://gitlab.com/-/project/6922885/uploads/245eec8867a47057cbc54535f73b32ee/AuroraStore-4.8.4.apk)\n' +
        '[x.apk](/uploads/00000000000000000000000000000000/x.apk)',
    };
    assert.deepEqual(gitlabReleaseAssets(release, 'AuroraOSS/AuroraStore'), [
      {
        name: 'AuroraStore-4.8.4.apk',
        url: 'https://gitlab.com/-/project/6922885/uploads/245eec8867a47057cbc54535f73b32ee/AuroraStore-4.8.4.apk',
      },
      {
        name: 'x.apk',
        url: 'https://gitlab.com/AuroraOSS/AuroraStore/uploads/00000000000000000000000000000000/x.apk',
      },
    ]);
  });

  it('merges asset links and drops duplicates', () => {
    const url = 'https://gitlab.com/-/project/1/uploads/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/a.apk';
    const out = gitlabReleaseAssets(
      { assets: { links: [{ direct_asset_url: url }] }, description: `see ${url}` },
      'g/p',
    );
    assert.equal(out.length, 1);
  });
});

describe('resolveApkLink', () => {
  const reply = (body: unknown, ok = true, status = 200) =>
    (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;

  it('takes the newest GitLab release even when its APK is only linked in the notes', async () => {
    const releases = [
      {
        tag_name: '4.8.4',
        assets: { links: [] },
        description:
          'https://gitlab.com/-/project/6922885/uploads/245eec8867a47057cbc54535f73b32ee/AuroraStore-4.8.4.apk',
      },
      {
        tag_name: '4.7.5',
        assets: { links: [{ name: 'AuroraStore-4.7.5.apk', url: 'https://gitlab.com/old.apk' }] },
        description: '',
      },
    ];
    const link = await resolveApkLink(gitlab, 'arm64', reply(releases));
    assert.equal(link?.name, 'AuroraStore-4.8.4.apk');
  });

  it('reads GitHub release assets', async () => {
    const releases = [
      { assets: [{ name: 'notes.txt', browser_download_url: 'https://x/notes.txt' }] },
      { assets: [{ name: 'tv-bro-arm64-v8a.apk', browser_download_url: 'https://x/a.apk' }] },
    ];
    const link = await resolveApkLink(github, 'arm64', reply(releases));
    assert.deepEqual(
      { name: link?.name, url: link?.url },
      { name: 'tv-bro-arm64-v8a.apk', url: 'https://x/a.apk' },
    );
  });

  it('returns fixed links without any request', async () => {
    const never = (async () => {
      throw new Error('should not fetch');
    }) as unknown as typeof fetch;
    const link = await resolveApkLink(direct, 'auto', never);
    assert.equal(link?.url, 'https://f-droid.org/F-Droid.apk');
  });

  it('throws when the host refuses, and gives null when nothing matches', async () => {
    await assert.rejects(resolveApkLink(github, 'arm64', reply({}, false, 403)), /HTTP 403/);
    assert.equal(await resolveApkLink(github, 'arm64', reply([])), null);
  });
});
