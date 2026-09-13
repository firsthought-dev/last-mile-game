#!/bin/bash
# Sync web assets from last-mile/ to last-mile/android/app/src/main/assets/
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ASSETS_DIR="$DIR/android/app/src/main/assets"

echo "Syncing last-mile web bundle to Android assets..."
mkdir -p "$ASSETS_DIR"
cp "$DIR/index.html" "$ASSETS_DIR/"
cp "$DIR/game.js" "$ASSETS_DIR/"
cp "$DIR/style.css" "$ASSETS_DIR/"

# --delete, because this used to be `cp -r`, which only ever adds and
# overwrites. Deleting a file from last-mile/assets/ left the copy here alive
# forever, so retired textures kept shipping inside the APK long after nothing
# referenced them. This directory is generated wholesale from last-mile/ and
# holds nothing of its own, so mirroring deletions is safe.
rsync -a --delete "$DIR/assets/" "$ASSETS_DIR/assets/"

echo "✅ Android assets successfully synced!"
