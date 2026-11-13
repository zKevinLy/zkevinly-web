// Batch-install script builder. Pure functions, no Node-only APIs: the build uses
// them to collect the installable apps on a page, and the browser (Installer.astro)
// calls `buildInstallScript` every time a checkbox or the device dropdown changes.
//
// The generated PowerShell does NOT contain APK links. For each app it asks GitHub or
// GitLab for the newest release when it runs, so the links can never go stale.

import type { Entry, TopicBlock } from '../config/types';
import { entryRepo, repoHost, repoPath } from './github';

/* ---------- Devices ---------- */

export type DeviceId = 'auto' | 'arm64' | 'arm32' | 'x86_64' | 'x86';

export interface InstallDevice {
  id: DeviceId;
  label: string;
  hint: string;
}

export const DEVICES: InstallDevice[] = [
  {
    id: 'auto',
    label: 'Not sure: detect it with adb',
    hint: 'The script asks the connected device for its CPU before it picks any APK.',
  },
  {
    id: 'arm64',
    label: '64-bit ARM (arm64-v8a)',
    hint: 'Nvidia Shield, Google TV Streamer, and most recent TVs and boxes. Older 32-bit builds are used as a fallback.',
  },
  {
    id: 'arm32',
    label: '32-bit ARM (armeabi-v7a)',
    hint: 'Fire TV Sticks and many older boxes and TVs.',
  },
  {
    id: 'x86_64',
    label: 'x86-64',
    hint: 'Android emulators and some mini PCs. 32-bit x86 builds are used as a fallback.',
  },
  {
    id: 'x86',
    label: '32-bit x86',
    hint: 'Rare: older x86 Android devices.',
  },
];

export const isDeviceId = (value: string): value is DeviceId =>
  DEVICES.some((device) => device.id === value);

/**
 * Regexes matched against APK file names, best match first (the second one is an older
 * build the CPU can still run). Kept in one table so the fixed and auto-detect scripts
 * can't drift apart.
 */
const ABI_KEYS: Record<Exclude<DeviceId, 'auto'>, string[]> = {
  arm64: ['arm64|aarch64|v8a', 'armeabi|armv7|v7a'],
  arm32: ['armeabi|armv7|v7a'],
  x86_64: ['x86_64|x64', 'x86(?!_64)'],
  x86: ['x86(?!_64)'],
};

/** A file name that names some CPU (so it isn't a universal build). */
const ANY_ARCH = '[-_.](arm|aarch|x86|x64|mips|v7a|v8a)';

/* ---------- Apps ---------- */

export type InstallSource =
  { host: 'github' | 'gitlab'; path: string } | { host: 'url'; url: string };

export interface InstallApp {
  id: string;
  name: string;
  source: InstallSource;
  /** Case-insensitive regex narrowing which release asset to take. */
  match?: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Stable id for an entry's checkbox: its title's slug (same one Node uses for its anchor). */
export const installId = (entry: Pick<Entry, 'title'>) => slugify(entry.title);

/** The app behind an entry, or null when it isn't installable (or has nowhere to download from). */
export function resolveInstallApp(entry: Entry): InstallApp | null {
  if (!entry.install) return null;

  const base = { id: installId(entry), name: entry.title, match: entry.install.match };
  if (entry.install.url) return { ...base, source: { host: 'url', url: entry.install.url } };

  const repo = entryRepo(entry);
  return repo ? { ...base, source: { host: repoHost(repo), path: repoPath(repo) } } : null;
}

/** Every installable app in a page's entry blocks, in page order. */
export function installableApps(blocks: TopicBlock[]): InstallApp[] {
  return blocks.flatMap((block) =>
    block.type === 'entries' ? block.items.flatMap((entry) => resolveInstallApp(entry) ?? []) : [],
  );
}

/* ---------- Direct APK links (browser) ---------- */
// Mirrors what the PowerShell script does, so someone browsing on the Android device itself
// can pick apps and download the APKs without a PC or adb.

export interface ApkAsset {
  name: string;
  url: string;
}

export interface ApkLink extends ApkAsset {
  app: InstallApp;
}

/** CPU regexes for a device. A browser can't ask adb, so "auto" assumes 64-bit ARM. */
export const abiKeysFor = (device: DeviceId): string[] =>
  ABI_KEYS[device === 'auto' ? 'arm64' : device];

/** Same ranking as the script's Select-Apk: this CPU, then universal, then an older compatible build. */
export function selectApk(assets: ApkAsset[], keys: string[], match?: string): ApkAsset | null {
  const wanted = match ? new RegExp(match, 'i') : null;
  const ranked: { rank: number; asset: ApkAsset }[] = [];

  for (const asset of assets) {
    if (!asset.name.toLowerCase().endsWith('.apk')) continue;
    if (wanted && !wanted.test(asset.name)) continue;
    const named = (pattern: string) => new RegExp(pattern, 'i').test(asset.name);
    const rank = named(keys[0])
      ? 0
      : !named(ANY_ARCH)
        ? 1
        : keys.length > 1 && named(keys[1])
          ? 2
          : null;
    if (rank !== null) ranked.push({ rank, asset });
  }

  // Array.prototype.sort is stable, so equal ranks keep the release's own order.
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked[0]?.asset ?? null;
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|\s]+/g, '_');

const fileFromUrl = (url: string): string => {
  try {
    return safeName(decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''));
  } catch {
    return '';
  }
};

/**
 * Every APK a GitLab release offers: its asset links plus APKs uploaded to the project and
 * linked from the release notes (how Aurora Store ships, so they are not in `assets.links`).
 */
export function gitlabReleaseAssets(release: unknown, project: string): ApkAsset[] {
  const r = (release ?? {}) as {
    assets?: { links?: { direct_asset_url?: unknown; url?: unknown; name?: unknown }[] };
    description?: unknown;
  };
  const urls: string[] = [];

  for (const link of r.assets?.links ?? []) {
    const url = link.direct_asset_url || link.url;
    if (typeof url === 'string' && url) urls.push(url);
  }

  const notes = typeof r.description === 'string' ? r.description : '';
  const uploads =
    /(?:https:\/\/gitlab\.com)?\/[^\s()[\]]*uploads\/[0-9a-f]{32}\/[^\s()[\]]+\.apk/gi;
  for (const [found] of notes.matchAll(uploads)) {
    if (found.startsWith('https')) urls.push(found);
    else if (found.startsWith('/uploads/')) urls.push(`https://gitlab.com/${project}${found}`);
    else urls.push(`https://gitlab.com${found}`);
  }

  return [...new Set(urls)].map((url) => ({ name: fileFromUrl(url), url }));
}

const githubReleaseAssets = (release: unknown): ApkAsset[] => {
  const assets = (release as { assets?: { name?: unknown; browser_download_url?: unknown }[] })
    ?.assets;
  return (assets ?? []).flatMap((a) =>
    typeof a.name === 'string' && typeof a.browser_download_url === 'string'
      ? [{ name: a.name, url: a.browser_download_url }]
      : [],
  );
};

/** Newest release (pre-releases included) that has a matching APK, or null. Throws on a failed request. */
export async function resolveApkLink(
  app: InstallApp,
  device: DeviceId = 'auto',
  fetchImpl: typeof fetch = fetch,
): Promise<ApkLink | null> {
  const { source } = app;
  if (source.host === 'url') {
    return { app, name: urlFileName(source.url, app.name), url: source.url };
  }

  const keys = abiKeysFor(device);
  const api =
    source.host === 'github'
      ? `https://api.github.com/repos/${source.path}/releases?per_page=30`
      : `https://gitlab.com/api/v4/projects/${encodeURIComponent(source.path)}/releases`;
  const res = await fetchImpl(api, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${source.host} answered HTTP ${res.status}`);

  const releases: unknown = await res.json();
  if (!Array.isArray(releases)) throw new Error(`${source.host} sent an unexpected reply`);

  for (const release of releases) {
    const assets =
      source.host === 'github'
        ? githubReleaseAssets(release)
        : gitlabReleaseAssets(release, source.path);
    const apk = selectApk(assets, keys, app.match);
    if (apk) return { app, ...apk };
  }
  return null;
}

/* ---------- Script ---------- */

/** A PowerShell single-quoted string. */
const ps = (value: string) => `'${value.replace(/'/g, "''")}'`;

const psArray = (values: string[]) => `@(${values.map(ps).join(', ')})`;

/** File name for a fixed APK link: the last path segment, forced to end in .apk. */
function urlFileName(url: string, fallback: string): string {
  let name = '';
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    // Not a valid URL: use the fallback.
  }
  name = name.replace(/[^\w.-]+/g, '-');
  return name.toLowerCase().endsWith('.apk') ? name : `${slugify(fallback) || 'app'}.apk`;
}

function findBlock(app: InstallApp): string {
  const { source } = app;
  if (source.host === 'url') {
    const fileName = urlFileName(source.url, app.name);
    return `[pscustomobject]@{ Name = ${ps(fileName)}; Url = ${ps(source.url)} }`;
  }
  const fn = source.host === 'github' ? 'Get-GitHubApk' : 'Get-GitLabApk';
  return [fn, ps(source.path), ...(app.match ? [ps(app.match)] : [])].join(' ');
}

/** Where a person can download the app by hand if the script can't (shown on failure). */
function pageUrl(app: InstallApp): string {
  const { source } = app;
  if (source.host === 'url') return source.url;
  return source.host === 'github'
    ? `https://github.com/${source.path}/releases`
    : `https://gitlab.com/${source.path}/-/releases`;
}

const AUTO_DETECT = `# Ask the connected device which CPU it has
$abi = "$(adb shell getprop ro.product.cpu.abi)".Trim()
if (-not $abi) { throw 'No device found. Connect first, e.g. adb connect <tv-ip>' }
$abiKeys = @(switch -Wildcard ($abi) {
    'arm64*'   { ${psArray(ABI_KEYS.arm64)} }
    'armeabi*' { ${psArray(ABI_KEYS.arm32)} }
    'x86_64'   { ${psArray(ABI_KEYS.x86_64)} }
    default    { ${psArray(ABI_KEYS.x86)} }
})
Write-Host "Device CPU: $abi"`;

const SELECT_APK = `# Best APK first: built for this CPU, then universal, then an older compatible build
$anyArch = ${ps(ANY_ARCH)}
function Select-Apk($assets, $match) {
    $assets |
        Where-Object { $_.Name -like '*.apk' -and (-not $match -or $_.Name -match $match) } |
        ForEach-Object {
            $rank = if ($_.Name -match $abiKeys[0]) { 0 }
                    elseif ($_.Name -notmatch $anyArch) { 1 }
                    elseif ($abiKeys.Count -gt 1 -and $_.Name -match $abiKeys[1]) { 2 }
            if ($null -ne $rank) { $_ | Add-Member -NotePropertyName Rank -NotePropertyValue $rank -PassThru }
        } |
        Sort-Object Rank |
        Select-Object -First 1
}`;

// GitHub allows 60 anonymous API calls an hour per IP; GitLab has a similar limit. On a
// 403/429 this throws a plain-English message (with the reset time when the server
// sends one) instead of a raw HTTP error, and the install loop carries on with the rest.
const API_HELPER = `# Call a release API; turn a rate limit into a readable message
function Invoke-Api($url) {
    try { Invoke-RestMethod $url -Headers $headers -ErrorAction Stop }
    catch {
        $resp = $_.Exception.Response
        $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
        if ($code -eq 403 -or $code -eq 429) {
            $when = ''
            foreach ($name in 'X-RateLimit-Reset', 'RateLimit-Reset') {
                try {
                    $reset = if ($resp.Headers -is [Net.WebHeaderCollection]) { $resp.Headers[$name] } else { $resp.Headers.GetValues($name) | Select-Object -First 1 }
                    if ($reset) { $when = " Try again after $([DateTimeOffset]::FromUnixTimeSeconds([long]$reset).LocalDateTime.ToString('t'))."; break }
                } catch { }
            }
            throw "rate limit reached on $(([uri]$url).Host).$when"
        }
        throw
    }
}`;

const GITHUB = `# Newest release (pre-releases included) that has a matching APK
function Get-GitHubApk($repo, $match) {
    $releases = Invoke-Api "https://api.github.com/repos/$repo/releases?per_page=30"
    foreach ($release in $releases) {
        $assets = $release.assets | ForEach-Object { [pscustomobject]@{ Name = $_.name; Url = $_.browser_download_url } }
        $apk = Select-Apk $assets $match
        if ($apk) { return $apk }
    }
}`;

const GITLAB = `function Get-GitLabApk($project, $match) {
    $id = [uri]::EscapeDataString($project)
    $releases = Invoke-Api "https://gitlab.com/api/v4/projects/$id/releases"
    foreach ($release in $releases) {
        $urls = @()
        foreach ($l in $release.assets.links) {
            $urls += $(if ($l.direct_asset_url) { $l.direct_asset_url } else { $l.url })
        }
        # APKs uploaded to the project and linked from the release notes
        foreach ($m in [regex]::Matches("$($release.description)", '(?:https://gitlab\\.com)?/[^\\s()\\[\\]]*uploads/[0-9a-f]{32}/[^\\s()\\[\\]]+\\.apk')) {
            $u = $m.Value
            if ($u -notmatch '^https') {
                $u = if ($u -match '^/uploads/') { "https://gitlab.com/$project$u" } else { "https://gitlab.com$u" }
            }
            $urls += $u
        }
        $assets = $urls | Select-Object -Unique | ForEach-Object {
            [pscustomobject]@{ Name = ([IO.Path]::GetFileName(([uri]$_).AbsolutePath) -replace '[\\\\/:*?"<>|\\s]+', '_'); Url = $_ }
        }
        $apk = Select-Apk $assets $match
        if ($apk) { return $apk }
    }
}`;

// Two phases so the slow part (downloading) overlaps with everything else. Phase 1 looks each
// app up and starts its download in the background; phase 2 walks the list in order, waits for
// each file, and installs it. Installs stay one at a time: adb queues them on the device anyway,
// and parallel installs on a TV tend to fail with low storage or memory. WebClient (not
// Invoke-WebRequest, ForEach-Object -Parallel or jobs) keeps this working on Windows PowerShell
// 5.1 and 7 without moving the helper functions into other processes.
const INSTALL_LOOP = `$failed = @()
$rateLimited = $false
function Add-Failure($app, $err) {
    Write-Warning "$($app.Name): $err"
    if ("$err" -match 'rate limit') { $script:rateLimited = $true }
    $script:failed += $(if ($app.Page) { "$($app.Name) ($($app.Page))" } else { $app.Name })
}

# Phase 1: look each app up and start its download in the background
$downloads = @()
foreach ($app in $apps) {
    try {
        Write-Host "Looking up $($app.Name)..."
        $apk = & $app.Find
        if (-not $apk) { throw 'no matching APK found in the latest releases' }
        Write-Host "Downloading $($apk.Name)..."
        $path = Join-Path (Get-Location).Path $apk.Name
        $client = New-Object Net.WebClient
        $downloads += [pscustomobject]@{ App = $app; Apk = $apk; Path = $path; Client = $client; Task = $client.DownloadFileTaskAsync($apk.Url, $path) }
    }
    catch { Add-Failure $app $_ }
}

# Phase 2: install in order as each download finishes (one at a time: adb queues them anyway)
foreach ($d in $downloads) {
    try {
        $d.Task.GetAwaiter().GetResult()
        Write-Host "Installing $($d.Apk.Name)..."
        adb install -r $d.Path
        if ($LASTEXITCODE -ne 0) { throw 'adb install failed' }
    }
    catch { Add-Failure $d.App $_ }
    finally {
        $d.Client.Dispose()
        Remove-Item $d.Path -ErrorAction SilentlyContinue
    }
}

if ($failed) {
    Write-Host 'Finished, but these need a manual install:'
    $failed | ForEach-Object { Write-Host "  $_" }
    if ($rateLimited) { Write-Host 'GitHub or GitLab is rate limiting this connection. Wait a bit and run the script again, or grab the APKs from the pages above.' }
}
else { Write-Host 'All apps installed.' }`;

export const EMPTY_SCRIPT = '# Tick at least one app above and your script will appear here.';

/**
 * PowerShell that downloads the newest APK of every given app and installs it with adb.
 * Only the helpers the selected apps need are included.
 */
export function buildInstallScript(apps: InstallApp[], device: DeviceId = 'auto'): string {
  if (apps.length === 0) return EMPTY_SCRIPT;

  const needsLookup = apps.some((app) => app.source.host !== 'url');
  const needs = (host: InstallSource['host']) => apps.some((app) => app.source.host === host);

  const prelude = [
    "if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw 'adb was not found in your PATH.' }",
    '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12',
    "$ProgressPreference = 'SilentlyContinue'",
    ...(needsLookup ? ["$headers = @{ 'User-Agent' = 'zkevinly-install-script' }"] : []),
  ].join('\n');

  const abi = !needsLookup
    ? null
    : device === 'auto'
      ? AUTO_DETECT
      : `# Device CPU: ${DEVICES.find((d) => d.id === device)?.label ?? device}\n$abiKeys = ${psArray(ABI_KEYS[device])}`;

  const table = `$apps = @(\n${apps
    .map((app) => `    @{ Name = ${ps(app.name)}; Find = { ${findBlock(app)} }; Page = ${ps(pageUrl(app))} }`)
    .join(',\n')}\n)`;

  return [
    prelude,
    abi,
    needsLookup ? API_HELPER : null,
    needsLookup ? SELECT_APK : null,
    needs('github') ? GITHUB : null,
    needs('gitlab') ? GITLAB : null,
    table,
    INSTALL_LOOP,
  ]
    .filter((part): part is string => part !== null)
    .join('\n\n');
}
