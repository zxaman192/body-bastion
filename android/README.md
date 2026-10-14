# Body Bastion for Android

A small native app (about 35 KB) that runs the hosted game full-screen in a WebView:

- **Splash:** plays the opening animation (blood vessel, neutrophil, antibodies, crest) from the APK
  itself while it wakes the server (the free Render plan sleeps after 15 idle minutes), then opens
  the game. Returning players get the short version.
- **Full-screen and immersive:** no browser bars; rotates freely; the Android back button goes back a
  screen and asks before leaving the game.
- **Offline page:** if the server cannot be reached, a "Try again" screen instead of a browser error.
- Links to other sites open in the phone's browser. Admin CSV exports need a desktop browser.
- Adaptive launcher icon (with a monochrome layer for themed icons) and an Android 12+ splash icon.

The game URL is set in `src/com/bodybastion/app/MainActivity.java` (`SITE`, `HOST`).

## Build

Needs the Android SDK (build-tools and one platform) and a JDK 17+. Android Studio provides both;
no Gradle is used. From the repository root:

```bash
bash android/build_apk.sh
```

The signed APK is written to `dist/BodyBastion-<version>-<release name>.apk`; older builds are kept. The first build creates a signing key
in `../android-signing/` (outside the repository) with its password in `keystore.properties`. Back
both files up: every later update must be signed with the same key or phones will refuse to install
it over the old version.

Set `VERSION_NAME`, `VERSION_CODE` (higher than the last release) and `RELEASE_NAME` for a new release, for
example `VERSION_NAME=1.4.1 VERSION_CODE=141 RELEASE_NAME=Laparotomy bash android/build_apk.sh`.

## Install on a phone

Copy the APK to the phone and open it. Android asks once to allow installing apps from that source
(Files, Chrome or Drive). Requires Android 8.0 or newer.
