import type { TopicPage } from '../types';

/**
 * Every card on this page draws its tags from this one small set (8 at most), so the
 * filter chips actually group cards instead of each card having tags of its own.
 * tests/config enforces it. Add to it only when several cards share the new tag.
 */
const androidTv: TopicPage = {
  type: 'topic',
  slug: 'android-tv',
  group: 'collections',

  title: 'Android TV',
  description: 'GitHub repos for the Android TV apps I use.',
  tags: ['android-tv', 'apps', 'browser', 'launcher', 'youtube', 'media', 'github'],

  introduction:
    'The Android TV apps I actually keep installed. Tap a card to tick it, use the arrow icon to open its page, then grab download links or a ready-made install script for everything you ticked. Cards for GitHub-hosted apps show the latest release, star count, and when the repo was last updated. Use the filter to narrow by tag or sort by recent activity.',

  blocks: [
    {
      type: 'entries',
      title: 'Apps',
      items: [
        {
          title: 'TV Bro',
          description:
            'Web browser built for TV remotes, with tabs, bookmarks, voice search, and a built-in download manager.',
          href: 'https://github.com/truefedex/tv-bro',
          // Its own update feed ships geckoIncluded builds per CPU (arm64-v8a, armeabi-v7a, x86_64).
          install: { match: '^(?!.*geckoIncluded)' },
          tags: ['interface', 'remote', 'open-source'],
        },
        {
          title: 'Projectivy Launcher',
          description:
            'Customizable, ad-free Android TV launcher with wallpapers, icon packs, and plugins. This repo hosts the APKs and the issue tracker.',
          href: 'https://github.com/spocky/miproja1',
          // One universal APK per release: ProjectivyLauncher-<ver>-c<build>-xda-release.apk
          install: { match: 'xda-release' },
          tags: ['interface', 'ad-free'],
        },
        {
          title: 'Nuvio',
          description: 'Official Nuvio Android TV app, powered by the Stremio addon ecosystem.',
          href: 'https://github.com/NuvioMedia/NuvioTV',
          install: {},
          tags: ['streaming'],
          related: [
            {
              label: 'Setup guide',
              title: 'Nuvio setup instructions',
              href: '/collections/nuvio',
            },
          ],
        },
        {
          title: 'SmartTube',
          description: 'Ad-free YouTube client for Android TV.',
          href: 'https://github.com/yuliskov/SmartTube',
          // Betas are published alongside stable (and are often newer), so only take stable.
          install: { match: 'stable' },
          tags: ['streaming', 'ad-free', 'open-source'],
        },
        {
          title: 'Aurora Store',
          description:
            'Open-source Google Play client. Browse, install, and update apps without the Play Store, and sign in anonymously if you’d rather not use a Google account.',
          href: 'https://gitlab.com/AuroraOSS/AuroraStore/-/releases',
          // Each release also has -hw (Huawei) and -preload (system image) builds: skip those.
          install: { match: '^(?!.*(hw|preload))' },
          tags: ['app-store', 'open-source'],
        },
        {
          title: 'F-Droid',
          description:
            'Open-source app store for free and open-source Android apps, with its own update checks.',
          href: 'https://f-droid.org/',
          install: { url: 'https://f-droid.org/F-Droid.apk' },
          repo: 'gitlab:fdroid/fdroidclient',
          tags: ['app-store', 'open-source'],
        },
        {
          title: 'Key Mapper',
          description:
            'Open-source key remapper for Android. Remap remote and keyboard buttons to actions, shortcuts, and macros.',
          href: 'https://github.com/keymapperorg/KeyMapper',
          install: {},
          tags: ['remote', 'open-source'],
        },
      ],
    },
    {
      type: 'installer',
      title: 'Install your selection',
      description:
        'Pick your device’s CPU, then get download links for the apps you ticked above. On a PC instead? Copy the PowerShell script at the bottom: it finds each app’s newest release itself, so there are no links to fill in.',
    },
    {
      type: 'entries',
      title: 'ADB quickstart',
      description:
        'Sideload several APKs onto your TV in one go. Replace each [apk link] with a direct download link, then run it in PowerShell with the TV connected over ADB.',
      items: [
        {
          title: 'Batch install APKs',
          description:
            'Downloads each APK, installs it on the connected TV with adb, then deletes the file. Needs adb in your PATH and ADB debugging enabled on the TV.',
          href: 'https://developer.android.com/tools/adb',
          tags: ['adb'],
          commands: [
            {
              label: 'PowerShell',
              command: `$apks = @(
    "[apk link 1]",
    "[apk link 2]",
    "[apk link 3]"
)

foreach ($url in $apks) {
    $outFile = $url.Split('/')[-1]
    Write-Host "Downloading $outFile..."
    Invoke-WebRequest -Uri $url -OutFile $outFile
    Write-Host "Installing $outFile..."
    adb install -r $outFile
    Remove-Item $outFile
}`,
            },
          ],
        },
      ],
    },
  ],
};

export default androidTv;
