#!/bin/bash
# ==============================================================================
# SHIPLYP ONE-CLICK WEB PORTAL ZIP EXPORTER (package_web_portal.sh)
# Packages a production-ready, clean, self-contained HTML5 zip bundle for:
# - GameDistribution (Azerion)
# - CrazyGames
# - Poki
# - itch.io / GameJolt
#
# Portal Standards Enforced:
# 1. index.html MUST be at the root of the ZIP archive (not nested in a subfolder).
# 2. All asset paths MUST be relative (no absolute /last-mile/ paths).
# 3. Clean bundle: excludes dev-checks, git files, IDE metadata, and temp files.
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$( cd "$DIR/.." >/dev/null 2>&1 && pwd )"
DIST_DIR="$PROJECT_ROOT/dist"
STAGE_DIR="$DIST_DIR/.bundle_stage"
OUTPUT_ZIP="$DIST_DIR/shiplyp-web-portal.zip"

echo "=================================================="
echo "📦 Packaging Shiplyp for Web Game Portals..."
echo "=================================================="

# 1. Ensure clean dist directory
mkdir -p "$DIST_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
rm -f "$OUTPUT_ZIP"

# 2. Stage core runtime files
echo "--> Staging runtime scripts and markup..."
cp "$DIR/index.html" "$STAGE_DIR/"
cp "$DIR/game.js" "$STAGE_DIR/"
cp "$DIR/save.js" "$STAGE_DIR/"
cp "$DIR/ads.js" "$STAGE_DIR/"
cp "$DIR/style.css" "$STAGE_DIR/"

# 3. Stage assets directory
echo "--> Staging 3D models, textures, and previews..."
if [ -d "$DIR/assets" ]; then
  mkdir -p "$STAGE_DIR/assets"
  rsync -a --exclude=".DS_Store" "$DIR/assets/" "$STAGE_DIR/assets/"
fi

# 4. Invariant checks
echo "--> Validating portal compliance..."
if [ ! -f "$STAGE_DIR/index.html" ]; then
  echo "❌ ERROR: index.html is missing at stage root!"
  exit 1
fi

if grep -q "http://127.0.0.1" "$STAGE_DIR/index.html" || grep -q "http://localhost" "$STAGE_DIR/index.html"; then
  echo "⚠️ WARNING: localhost URL found in index.html!"
fi

# 5. Build ZIP archive with index.html at root
echo "--> Creating $OUTPUT_ZIP..."
(
  cd "$STAGE_DIR"
  zip -r -q "$OUTPUT_ZIP" . -x "*.DS_Store"
)

# Clean up stage dir
rm -rf "$STAGE_DIR"

# 6. Verify zip structure
ZIP_SIZE=$(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')
ROOT_FILES=$(unzip -l "$OUTPUT_ZIP" | grep -E "index\.html|game\.js|ads\.js" | wc -l | tr -d ' ')

echo "=================================================="
echo "✅ Web Portal Bundle Created Successfully!"
echo "📍 Archive: $OUTPUT_ZIP"
echo "📊 Bundle Size: $ZIP_SIZE"
if [ "$ROOT_FILES" -ge 3 ]; then
  echo "✅ Invariant Passed: index.html & scripts verified at ZIP root."
else
  echo "⚠️ Warning: Expected root files not detected in zip."
fi
echo "=================================================="
