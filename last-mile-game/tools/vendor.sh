#!/bin/bash
# Copy third-party runtime files out of node_modules into last-mile/vendor/
# (committed, so a checkout needs no network to build or run).
#   npm install && bash tools/vendor.sh
set -e
ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
NM="$ROOT/node_modules"
OUT="$ROOT/last-mile/vendor"

# --- Three.js r128 (global build + examples/js add-ons the game uses) ---
T="$OUT/three"
mkdir -p "$T"
cp "$NM/three/build/three.min.js" "$T/"
for f in loaders/GLTFLoader utils/SkeletonUtils shaders/CopyShader \
         shaders/LuminosityHighPassShader shaders/FXAAShader \
         postprocessing/EffectComposer postprocessing/RenderPass \
         postprocessing/ShaderPass postprocessing/UnrealBloomPass; do
  cp "$NM/three/examples/js/$f.js" "$T/"
done
cp "$NM/three/LICENSE" "$T/LICENSE"
echo "Vendored Three.js $(node -p "require('$NM/three/package.json').version") -> $T"
