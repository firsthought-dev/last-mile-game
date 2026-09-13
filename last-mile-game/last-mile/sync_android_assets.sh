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
cp -r "$DIR/assets" "$ASSETS_DIR/"

echo "✅ Android assets successfully synced!"
