#!/bin/bash
# Stage the game's runtime files into one folder. This is the ONLY list of
# what ships: Vercel, the portal ZIP and the Android assets all call it.
# last-mile/ also holds the Obsidian vault and the Android project, which
# must never be published.
#
#   bash last-mile-game/last-mile/stage_web.sh <output-dir>
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
OUT="${1:?usage: stage_web.sh <output-dir>}"

rm -rf "$OUT"
mkdir -p "$OUT"
# Keep this list in step with the scripts index.html loads.
cp "$DIR"/{index.html,save.js,ads.js,police.js,style.css} "$OUT"/
[ -d "$DIR/js" ] && cp -r "$DIR/js" "$OUT/js"
cp -r "$DIR/assets" "$OUT/assets"
# Third-party code and fonts, once bundled locally (tools/vendor.sh).
[ -d "$DIR/vendor" ] && cp -r "$DIR/vendor" "$OUT/vendor"
find "$OUT" -name .DS_Store -delete

# The Vercel analytics snippet only works on Vercel (root-absolute path), so
# every other target (APK, portal ZIPs) drops it. vercel.json sets the target.
if [ "$STAGE_TARGET" != "vercel" ]; then
  sed '/vercel-analytics:start/,/vercel-analytics:end/d' "$OUT/index.html" > "$OUT/index.html.tmp"
  mv "$OUT/index.html.tmp" "$OUT/index.html"
fi

# Stamp the build so scripts are cached between visits but refresh per release.
BUILD="$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo dev)"
sed "s/__BUILD__/$BUILD/" "$OUT/index.html" > "$OUT/index.html.tmp"
mv "$OUT/index.html.tmp" "$OUT/index.html"
echo "Staged web build $BUILD in $OUT"
