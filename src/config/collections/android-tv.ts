import type { TopicPage } from '../types';

const androidTv: TopicPage = {
  type: 'topic',
  slug: 'android-tv',
  group: 'collections',

  title: 'Android TV',
  description: 'GitHub repos for the Android TV apps I use.',
  tags: ['android-tv', 'apps', 'browser', 'launcher', 'youtube', 'media', 'github'],

  introduction:
    'The Android TV apps I actually keep installed. Cards for GitHub-hosted apps show the latest release, star count, and when the repo was last updated, so you can tell at a glance what’s still maintained. Use the filter to narrow by tag or sort by recent activity.',

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
          install: { match: 'geckoIncluded' },
          tags: [
            'android-tv',
            'app',
            'browser',
            'remote-friendly',
            'tabs',
            'bookmarks',
            'voice-search',
            'downloads',
            'open-source',
            'github',
          ],
        },
        {
          title: 'Projectivy Launcher',
          description:
            'Customizable, ad-free Android TV launcher with wallpapers, icon packs, and plugins. This repo hosts the APKs and the issue tracker.',
          href: 'https://github.com/spocky/miproja1',
          // One universal APK per release: ProjectivyLauncher-<ver>-c<build>-xda-release.apk
          install: { match: 'xda-release' },
          tags: [
            'android-tv',
            'app',
            'launcher',
            'home-screen',
            'customization',
            'wallpapers',
            'icon-packs',
            'plugins',
            'ad-free',
            'apk',
            'github',
          ],
        },
        {
          title: 'Nuvio',
          description: 'Official Nuvio Android TV app, powered by the Stremio addon ecosystem.',
          href: 'https://github.com/NuvioMedia/NuvioTV',
          install: {},
          tags: [
            'android-tv',
            'app',
            'media',
            'streaming',
            'stremio-addons',
            'official',
            'pre-release',
            'github',
          ],
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
          tags: [
            'android-tv',
            'app',
            'youtube',
            'video',
            'ad-free',
            'sponsorblock',
            'open-source',
            'github',
          ],
        },
        {
          title: 'Aurora Store',
          description:
            'Open-source Google Play client. Browse, install, and update apps without the Play Store, and sign in anonymously if you’d rather not use a Google account.',
          href: 'https://gitlab.com/AuroraOSS/AuroraStore/-/releases',
          // Each release also has -hw (Huawei) and -preload (system image) builds: skip those.
          install: { match: '^(?!.*(hw|preload))' },
          tags: [
            'android-tv',
            'app',
            'app-store',
            'google-play',
            'updates',
            'anonymous-login',
            'open-source',
            'gitlab',
          ],
        },
        {
          title: 'F-Droid',
          description:
            'Open-source app store for free and open-source Android apps, with its own update checks.',
          href: 'https://f-droid.org/',
          install: { url: 'https://f-droid.org/F-Droid.apk' },
          repo: 'gitlab:fdroid/fdroidclient',
          tags: ['android-tv', 'app', 'app-store', 'f-droid', 'updates', 'open-source', 'gitlab'],
        },
        {
          title: 'Key Mapper',
          description:
            'Open-source key remapper for Android. Remap remote and keyboard buttons to actions, shortcuts, and macros.',
          href: 'https://github.com/keymapperorg/KeyMapper',
          install: {},
          tags: [
            'android-tv',
            'app',
            'remapping',
            'remote-friendly',
            'buttons',
            'macros',
            'accessibility',
            'open-source',
            'github',
          ],
        },
      ],
    },
    {
      type: 'installer',
      title: 'Build your install script',
      description:
        'Tick the apps you want above, pick your device’s CPU, and copy the PowerShell script. It finds each app’s newest release itself, so there are no links to fill in. Run it with the TV connected over ADB.',
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
          tags: ['adb', 'sideloading', 'apk', 'powershell', 'script', 'android-tv', 'install'],
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
