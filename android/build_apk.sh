#!/usr/bin/env bash
# Builds the Body Bastion Android app (a full-screen WebView around the hosted game) with the plain
# Android SDK command-line tools: no Gradle needed. Run from the repository root:
#   bash android/build_apk.sh
# Environment overrides: ANDROID_SDK, BUILD_TOOLS, PLATFORM_JAR, JAVA_HOME, KEYSTORE_DIR, VERSION_NAME, VERSION_CODE.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ANDROID_SDK="${ANDROID_SDK:-${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}}"
BUILD_TOOLS="${BUILD_TOOLS:-$(ls -d "$ANDROID_SDK"/build-tools/* | sort -V | tail -1)}"
PLATFORM_JAR="${PLATFORM_JAR:-$(ls -d "$ANDROID_SDK"/platforms/*/android.jar | sort -V | tail -1)}"
JAVA_HOME="${JAVA_HOME:-/c/Program Files/Android/Android Studio/jbr}"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"
KEYSTORE_DIR="${KEYSTORE_DIR:-$ROOT/../android-signing}"
VERSION_NAME="${VERSION_NAME:-1.3.0}"
VERSION_CODE="${VERSION_CODE:-130}"
MIN_SDK=26
TARGET_SDK=35
EXE=""; [ -f "$BUILD_TOOLS/aapt2.exe" ] && EXE=".exe"
BAT=""; [ -f "$BUILD_TOOLS/d8.bat" ] && BAT=".bat"

OUT="$HERE/build"
DIST="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/assets" "$DIST"

echo "== assets: splash page with the intro animation inlined"
cp "$HERE"/assets/* "$OUT/assets/"
INTRO="$(sed -e 's/^export function playIntro/function playIntro/' "$ROOT/static/js/intro.js")"
python_inline() {
  # replace the /*INTRO_JS*/ marker without sed escaping problems
  local tpl="$HERE/assets-src/splash.template.html"
  local before after
  before="$(sed -n '1,/\/\*INTRO_JS\*\//p' "$tpl" | sed '$d')"
  after="$(sed -n '/\/\*INTRO_JS\*\//,$p' "$tpl" | sed '1d')"
  printf '%s\n%s\n%s\n' "$before" "$INTRO" "$after" > "$OUT/assets/splash.html"
}
python_inline
grep -q "function playIntro" "$OUT/assets/splash.html"

echo "== resources"
"$BUILD_TOOLS/aapt2$EXE" compile --dir "$HERE/res" -o "$OUT/res/compiled.zip"
"$BUILD_TOOLS/aapt2$EXE" link -o "$OUT/app-unsigned.apk" -I "$PLATFORM_JAR" \
  --manifest "$HERE/AndroidManifest.xml" -A "$OUT/assets" "$OUT/res/compiled.zip" \
  --java "$OUT/gen" --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay

echo "== compile"
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
find "$HERE/src" "$OUT/gen" -name '*.java' | while read -r f; do winpath "$f"; echo; done > "$OUT/sources.txt"
javac --release 11 -nowarn -encoding UTF-8 -classpath "$PLATFORM_JAR" -d "$OUT/classes" @"$OUT/sources.txt"
jar cf "$OUT/classes.jar" -C "$OUT/classes" .
"$BUILD_TOOLS/d8$BAT" --release --min-api $MIN_SDK --lib "$PLATFORM_JAR" --output "$OUT/dex" "$OUT/classes.jar"

echo "== package"
( cd "$OUT/dex" && "$BUILD_TOOLS/aapt$EXE" add "$OUT/app-unsigned.apk" classes.dex >/dev/null )
"$BUILD_TOOLS/zipalign$EXE" -f -p 4 "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"

echo "== sign"
mkdir -p "$KEYSTORE_DIR"
KS="$KEYSTORE_DIR/bodybastion-release.jks"
PROPS="$KEYSTORE_DIR/keystore.properties"
if [ ! -f "$KS" ]; then
  PASS="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  keytool -genkeypair -keystore "$KS" -alias bodybastion -keyalg RSA -keysize 3072 -validity 10000 \
    -dname "CN=Body Bastion, OU=MAMC Gaming Society, O=Maulana Azad Medical College, L=New Delhi, C=IN" \
    -storepass "$PASS" -keypass "$PASS" >/dev/null
  printf 'storeFile=bodybastion-release.jks\nkeyAlias=bodybastion\nstorePassword=%s\nkeyPassword=%s\n' "$PASS" "$PASS" > "$PROPS"
  echo "   created signing key $KS (password in $PROPS) - back both up; updates must be signed with the same key"
fi
PASS="$(grep '^storePassword=' "$PROPS" | cut -d= -f2-)"
APK="$DIST/BodyBastion-$VERSION_NAME.apk"
"$BUILD_TOOLS/apksigner$BAT" sign --ks "$KS" --ks-key-alias bodybastion --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$APK" "$OUT/app-aligned.apk"
"$BUILD_TOOLS/apksigner$BAT" verify --verbose "$APK" | head -5
ls -l "$APK"
echo "== done: $APK"
