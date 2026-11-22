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
  abiKeysFor,
  isTrustedDownload,
  selectApk,
  type InstallApp,
} from '../../../src/lib/install/installer';
import type { Entry, TopicBlock } from '../../../src/config/types';

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

  it('downloads in the background and installs one at a time', () => {
    const script = buildInstallScript([github, gitlab], 'arm64');
    assert.match(script, /DownloadFileTaskAsync/);
    assert.doesNotMatch(script, /Invoke-WebRequest/);
    // Every download is started before the first install runs.
    assert.ok(script.indexOf('DownloadFileTaskAsync') < script.indexOf('adb install -r'));
    // Installs are sequential: no jobs or parallel loops.
    assert.doesNotMatch(script, /Start-Job|ForEach-Object -Parallel/);
    assert.equal(script.match(/adb install -r/g)?.length, 1);
  });

  it('needs no lookup or CPU for fixed links', () => {
    const script = buildInstallScript([direct], 'auto');
    assert.match(script, /Url = 'https:\/\/f-droid\.org\/F-Droid\.apk'/);
    assert.match(script, /Name = 'F-Droid\.apk'/);
    assert.doesNotMatch(script, /Select-Apk|abiKeys|getprop|\$headers/);
  });

  it('turns a 403/429 rate limit into a readable message and keeps going', () => {
    const script = buildInstallScript([github, gitlab], 'arm64');
    assert.match(script, /function Invoke-Api/);
    assert.match(script, /\$code -eq 403 -or \$code -eq 429/);
    assert.match(script, /X-RateLimit-Reset/);
    assert.match(script, /rate limit reached on/);
    // Both lookups go through the helper, never straight to Invoke-RestMethod.
    assert.match(script, /Get-GitHubApk[\s\S]*Invoke-Api "https:\/\/api\.github\.com/);
    assert.match(script, /Get-GitLabApk[\s\S]*Invoke-Api "https:\/\/gitlab\.com/);
    assert.equal(script.match(/Invoke-RestMethod/g)?.length, 1);
    // The per-app try/catch carries on and tells the person what to do.
    assert.match(script, /\$script:rateLimited = \$true/);
    assert.match(script, /run the script again/);
  });

  it('lists a manual download page for every app that fails', () => {
    const script = buildInstallScript([github, gitlab, direct], 'arm64');
    assert.match(script, /Page = 'https:\/\/github\.com\/truefedex\/tv-bro\/releases'/);
    assert.match(script, /Page = 'https:\/\/gitlab\.com\/AuroraOSS\/AuroraStore\/-\/releases'/);
    assert.match(script, /Page = 'https:\/\/f-droid\.org\/F-Droid\.apk'/);
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
    assert.ok(script.includes("|\\s]+', '_'"));
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
    assert.equal(
      pick(['app-universal.apk', 'app-arm64-v8a.apk', 'app-armeabi-v7a.apk']),
      'app-arm64-v8a.apk',
    );
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
      {
        assets: [
          {
            name: 'notes.txt',
            browser_download_url: 'https://github.com/o/r/releases/download/v1/notes.txt',
          },
        ],
      },
      {
        assets: [
          {
            name: 'tv-bro-arm64-v8a.apk',
            browser_download_url:
              'https://github.com/o/r/releases/download/v1/tv-bro-arm64-v8a.apk',
          },
        ],
      },
    ];
    const link = await resolveApkLink(github, 'arm64', reply(releases));
    assert.deepEqual(
      { name: link?.name, url: link?.url },
      {
        name: 'tv-bro-arm64-v8a.apk',
        url: 'https://github.com/o/r/releases/download/v1/tv-bro-arm64-v8a.apk',
      },
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

describe('download hardening', () => {
  const reply = (body: unknown) =>
    (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;

  it('only trusts https links on GitHub and GitLab hosts', () => {
    for (const url of [
      'https://github.com/o/r/releases/download/v1/a.apk',
      'https://objects.githubusercontent.com/x/a.apk',
      'https://release-assets.githubusercontent.com/x',
      'https://gitlab.com/-/project/1/uploads/abc/a.apk',
    ]) {
      assert.equal(isTrustedDownload(url), true, url);
    }
    for (const url of [
      'http://github.com/a.apk',
      'https://evil.example/a.apk',
      'https://github.com.evil.example/a.apk',
      'https://evilgithub.com/a.apk',
      'https://github.com@evil.example/a.apk',
      'javascript:alert(1)',
      'file:///etc/passwd',
      '//github.com/a.apk',
      'not a url',
      '',
    ]) {
      assert.equal(isTrustedDownload(url), false, url);
    }
  });

  it('ignores GitHub assets hosted anywhere else, falling back to a trusted one', async () => {
    const releases = [
      {
        assets: [
          { name: 'evil-arm64.apk', browser_download_url: 'https://evil.example/evil.apk' },
          { name: 'tv-bro-arm64.apk', browser_download_url: 'https://github.com/o/r/a.apk' },
        ],
      },
    ];
    const link = await resolveApkLink(github, 'arm64', reply(releases));
    assert.equal(link?.url, 'https://github.com/o/r/a.apk');
    const onlyEvil = [
      { assets: [{ name: 'a.apk', browser_download_url: 'http://github.com/a.apk' }] },
    ];
    assert.equal(await resolveApkLink(github, 'arm64', reply(onlyEvil)), null);
  });

  it('ignores GitLab links to other hosts, whether in assets or the release notes', async () => {
    const releases = [
      {
        assets: { links: [{ name: 'a.apk', url: 'https://evil.example/a.apk' }] },
        description: 'https://evil.example/uploads/b.apk',
      },
    ];
    assert.equal(await resolveApkLink(gitlab, 'arm64', reply(releases)), null);
  });

  it('makes release file names safe to use as a path', async () => {
    const releases = [
      {
        assets: [
          { name: '..\\..\\evil app?.apk', browser_download_url: 'https://github.com/o/r/a.apk' },
        ],
      },
    ];
    const link = await resolveApkLink(github, 'arm64', reply(releases));
    assert.doesNotMatch(link!.name, /[\\/:*?"<>|\s]/);
  });

  it('the script repeats the host rule and sanitises names on the PowerShell side', () => {
    const script = buildInstallScript([github], 'arm64');
    assert.match(script, /function Test-DownloadUrl/);
    assert.match(script, /\$u\.Scheme -eq 'https'/);
    assert.match(script, /github\\\.com\|githubusercontent\\\.com\|gitlab\\\.com/);
    assert.match(script, /\(Test-DownloadUrl \$_\.Url\)/);
    assert.match(script, /\$_\.name -replace/);
  });

  it('escapes every PowerShell quote character, not just the ASCII one', () => {
    const script = buildInstallScript(
      [{ ...github, name: "It's \u2018a\u2019 \u201Ab\u201B" }],
      'arm64',
    );
    assert.match(script, /Name = 'It''s \u2018\u2018a\u2019\u2019 \u201A\u201Ab\u201B\u201B'/);
  });

  it('keeps a name on one line so it cannot start a new statement', () => {
    const script = buildInstallScript([{ ...github, name: "x'\r\n; Remove-Item C:\\ #" }], 'arm64');
    assert.doesNotMatch(script, /^; Remove-Item/m);
    assert.match(script, /Name = 'x'' ; Remove-Item C:\\ #'/);
  });

  it('fixed links from the site config are not host-checked', async () => {
    const link = await resolveApkLink(direct, 'auto', reply({}));
    assert.equal(link?.url, 'https://f-droid.org/F-Droid.apk');
  });
});

describe('unusual releases and links', () => {
  const reply = (body: unknown) =>
    (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
  const uploads = (path: string) => `see ${path}/uploads/${'a'.repeat(32)}/app.apk`;

  it('the browser assumes 64-bit ARM for "auto"', () => {
    assert.deepEqual(abiKeysFor('auto'), abiKeysFor('arm64'));
    assert.notDeepEqual(abiKeysFor('x86'), abiKeysFor('arm64'));
  });

  it('GitLab: a release with no assets or notes yields nothing, and notes may be missing or odd', () => {
    assert.deepEqual(gitlabReleaseAssets(null, 'g/p'), []);
    assert.deepEqual(gitlabReleaseAssets({}, 'g/p'), []);
    assert.deepEqual(gitlabReleaseAssets({ description: 42, assets: {} }, 'g/p'), []);
  });

  it('GitLab: release-note uploads may be project-relative, site-relative or absolute', () => {
    const [a, b, c] = ['', '/group/proj', 'https://gitlab.com/group/proj'].map((prefix) =>
      gitlabReleaseAssets({ description: uploads(prefix) }, 'group/proj'),
    );
    assert.equal(a[0].url, `https://gitlab.com/group/proj/uploads/${'a'.repeat(32)}/app.apk`);
    assert.equal(b[0].url, `https://gitlab.com/group/proj/uploads/${'a'.repeat(32)}/app.apk`);
    assert.equal(c[0].url, `https://gitlab.com/group/proj/uploads/${'a'.repeat(32)}/app.apk`);
  });

  it('GitLab: a link whose name cannot be decoded gets an empty file name instead of failing', () => {
    const [asset] = gitlabReleaseAssets(
      { assets: { links: [{ url: 'https://gitlab.com/x/%E0%A4%A.apk' }] } },
      'g/p',
    );
    assert.equal(asset.name, '');
  });

  it('a release that is not an object, or has no assets, is skipped', async () => {
    const releases = [
      null,
      {},
      { assets: [{ name: 'tv-arm64.apk', browser_download_url: 'https://github.com/o/r/a.apk' }] },
    ];
    assert.equal(
      (await resolveApkLink(github, 'arm64', reply(releases)))?.url,
      'https://github.com/o/r/a.apk',
    );
    assert.equal(await resolveApkLink(gitlab, 'arm64', reply([null, {}])), null);
  });

  it('refuses a reply that is not a list of releases', async () => {
    await assert.rejects(
      resolveApkLink(github, 'arm64', reply({ message: 'nope' })),
      /unexpected reply/,
    );
  });

  it('names a fixed download from its URL, or from the app name when the URL says nothing useful', () => {
    const app = (url: string, name: string) => ({
      ...direct,
      name,
      source: { host: 'url' as const, url },
    });
    const script = buildInstallScript(
      [
        app('https://example.com/dl/My App.apk', 'One'),
        app('https://example.com/download?id=7', 'Two Words'),
        app('not a url at all', ''),
        app('https://example.com/%E0%A4%A', 'Broken'),
      ],
      'arm64',
    );
    assert.match(script, /My-App\.apk/);
    assert.match(script, /two-words\.apk/);
    assert.match(script, /app\.apk/);
    assert.match(script, /broken\.apk/);
  });

  it('says which CPU a chosen device is, in the script', () => {
    assert.match(buildInstallScript([github], 'x86_64'), /# Device CPU: /);
  });
});
