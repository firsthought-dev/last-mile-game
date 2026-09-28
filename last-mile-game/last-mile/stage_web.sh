#!/bin/bash
# Stage the game's public web files into one folder for hosting (Vercel).
# Only the runtime files are copied: last-mile/ also holds the Obsidian
# vault and the Android project, which must never be published.
#
#   bash last-mile-game/last-mile/stage_web.sh <output-dir>
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
OUT="${1:?usage: stage_web.sh <output-dir>}"

rm -rf "$OUT"
mkdir -p "$OUT"
# Keep this list in step with the scripts index.html loads.
cp "$DIR"/{index.html,game.js,save.js,ads.js,police.js,style.css} "$OUT"/
cp -r "$DIR/assets" "$OUT/assets"
echo "Staged web build in $OUT"
