#!/bin/bash
# Sync the web build from last-mile/ to last-mile/android/app/src/main/assets/
# by staging it with stage_web.sh first, so the APK ships exactly what the
# website and the portal ZIP ship.
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ASSETS_DIR="$DIR/android/app/src/main/assets"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "Syncing last-mile web bundle to Android assets..."
bash "$DIR/stage_web.sh" "$STAGE" >/dev/null
mkdir -p "$ASSETS_DIR"

# --delete, because this used to be `cp -r`, which only ever adds and
# overwrites. Deleting a file from last-mile/assets/ left the copy here alive
# forever, so retired textures kept shipping inside the APK long after nothing
# referenced them. This directory is generated wholesale from last-mile/ and
# holds nothing of its own, so mirroring deletions is safe.
rsync -a --delete "$STAGE/" "$ASSETS_DIR/"

echo "✅ Android assets successfully synced!"
