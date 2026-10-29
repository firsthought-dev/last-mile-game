#!/bin/bash
# Fails unless a staged build dir is complete, stamped and cache-friendly.
#   bash tools/check-stage.sh <staged-dir>
set -e
D="${1:?usage: check-stage.sh <staged-dir>}"
fail() { echo "check-stage FAIL: $1"; exit 1; }
for f in index.html save.js telemetry.js ads.js police.js style.css js/core.js js/boot.js assets/models/rickshaw.glb; do
  [ -f "$D/$f" ] || fail "missing $f"
done
grep -q "__BUILD = '__BUILD__'" "$D/index.html" && fail "index.html still has the __BUILD__ placeholder"
grep -q "__BUILD = '[A-Za-z0-9]" "$D/index.html" || fail "index.html has no build stamp"
echo "check-stage OK: $D"
