#!/usr/bin/env bash
# Installs the 3-D toolchain for building detailed models (AEROFORGE and later projects) on
# Ubuntu 24.04 (the Claude Code cloud image). Idempotent: anything already installed is skipped,
# so it is safe to run at every session start. One tool failing does not stop the others; the
# summary at the end lists what is ready.
#
#   Blender LTS (headless)   blender -b --python script.py        → /opt/3d-tools/blender
#   OpenVSP (NASA)           vsp, vspscript, Python API "openvsp"  → /opt/OpenVSP
#   Python 3-D venv          py3d (CadQuery, trimesh, manifold3d, OpenCV, Pillow, numpy, scipy,
#                            pygltflib, the OpenVSP API)           → /opt/3d-tools/py
#   glTF tools               gltf-transform, gltfpack              → /opt/3d-tools/node
#   KTX / Basis textures     toktx, ktx                            → KTX-Software .deb
#   Textures (CC0)           tools/fetch-texture.py (ambientCG, Poly Haven)
#
# Usage: bash tools/install-3d-tools.sh        (run as root; about 1.5 GB on first run)

set -uo pipefail

PREFIX=${TOOLS_PREFIX:-/opt/3d-tools}
BIN=/usr/local/bin
BLENDER_VERSION=4.5.14
OPENVSP_VERSION=3.55.0
KTX_VERSION=4.4.2
CACHE="$PREFIX/downloads"
mkdir -p "$PREFIX" "$CACHE" "$BIN"

declare -a READY=() FAILED=()
log() { printf '[3d-tools] %s\n' "$*" >&2; }
ok() { READY+=("$1"); }
fail() { FAILED+=("$1"); log "FAILED: $1"; }

fetch() { # url dest
  [ -s "$2" ] && return 0
  curl -fsSL --retry 3 --retry-delay 2 -o "$2.part" "$1" && mv "$2.part" "$2"
}

APT_UPDATED=0
apt_install() {
  local missing=()
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  [ ${#missing[@]} -eq 0 ] && return 0
  if [ $APT_UPDATED -eq 0 ]; then apt-get update -qq >/dev/null 2>&1; APT_UPDATED=1; fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}" >/dev/null 2>&1
}

# ---------------------------------------------------------------- system libraries
# Blender's X11/GL runtime, Mesa for software OpenGL/EGL (Workbench and EEVEE without a GPU),
# xvfb for anything that insists on a display, and the Python venv module.
apt_install xz-utils libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 libxkbcommon-x11-0 \
  libsm6 libice6 libgl1 libegl1 libgl1-mesa-dri libegl-mesa0 libglu1-mesa xvfb python3-venv \
  || fail "system libraries (apt)"

# ---------------------------------------------------------------- Blender
BL_DIR="$PREFIX/blender-$BLENDER_VERSION"
if [ ! -x "$BL_DIR/blender" ]; then
  log "Blender $BLENDER_VERSION"
  series=${BLENDER_VERSION%.*}
  tarball="$CACHE/blender-$BLENDER_VERSION-linux-x64.tar.xz"
  if fetch "https://download.blender.org/release/Blender$series/blender-$BLENDER_VERSION-linux-x64.tar.xz" "$tarball" \
    && tar -xJf "$tarball" -C "$PREFIX" && mv "$PREFIX/blender-$BLENDER_VERSION-linux-x64" "$BL_DIR"; then
    rm -f "$tarball"
  fi
fi
if [ -x "$BL_DIR/blender" ]; then
  ln -sfn "$BL_DIR" "$PREFIX/blender"
  ln -sf "$BL_DIR/blender" "$BIN/blender"
  "$BIN/blender" -b --factory-startup --python-expr "import bpy" >/dev/null 2>&1 && ok "blender $BLENDER_VERSION" || fail "blender (does not start)"
else
  fail "blender (download)"
fi

# ---------------------------------------------------------------- OpenVSP
if ! command -v vsp >/dev/null 2>&1; then
  log "OpenVSP $OPENVSP_VERSION"
  deb="$CACHE/OpenVSP-$OPENVSP_VERSION-Ubuntu-24.04_amd64.deb"
  if fetch "https://openvsp.org/download.php?file=zips/current/linux/OpenVSP-$OPENVSP_VERSION-Ubuntu-24.04_amd64.deb" "$deb"; then
    [ $APT_UPDATED -eq 0 ] && { apt-get update -qq >/dev/null 2>&1; APT_UPDATED=1; }
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$deb" >/dev/null 2>&1 && rm -f "$deb"
  fi
fi
VSP_HOME=$(dirname "$(readlink -f "$(command -v vsp 2>/dev/null || echo /nonexistent)")")
command -v vsp >/dev/null 2>&1 && ok "openvsp $OPENVSP_VERSION" || fail "openvsp"

# ---------------------------------------------------------------- Python 3-D environment
PY="$PREFIX/py"
if [ ! -x "$PY/bin/python" ]; then python3 -m venv "$PY" || fail "python venv"; fi
if [ -x "$PY/bin/python" ]; then
  "$PY/bin/python" -m pip install -q --upgrade pip >/dev/null 2>&1
  pkgs=(cadquery trimesh manifold3d numpy scipy pillow opencv-python-headless pygltflib shapely rtree networkx)
  "$PY/bin/python" -c "import cadquery, trimesh, manifold3d, cv2, PIL, pygltflib, scipy, shapely, rtree, networkx" >/dev/null 2>&1 \
    || "$PY/bin/python" -m pip install -q "${pkgs[@]}" >/dev/null 2>&1 \
    || fail "python packages (pip)"
  # OpenVSP's Python API ships inside the OpenVSP install as installable packages
  if [ -d "$VSP_HOME/python" ] && ! "$PY/bin/python" -c "import openvsp" >/dev/null 2>&1; then
    for p in utilities degen_geom openvsp_config openvsp; do
      [ -d "$VSP_HOME/python/$p" ] && "$PY/bin/python" -m pip install -q "$VSP_HOME/python/$p" >/dev/null 2>&1
    done
  fi
  # a wrapper, not a symlink: a symlinked venv interpreter does not find its pyvenv.cfg
  rm -f "$BIN/py3d"
  printf '#!/bin/sh\nexec %s "$@"\n' "$PY/bin/python" > "$BIN/py3d" && chmod +x "$BIN/py3d"
  "$BIN/py3d" -c "import cadquery, trimesh, manifold3d, cv2, PIL, pygltflib" >/dev/null 2>&1 && ok "py3d (cadquery, trimesh, manifold3d, opencv, pillow, pygltflib)" || fail "py3d imports"
  "$BIN/py3d" -c "import openvsp" >/dev/null 2>&1 && ok "openvsp python api" || log "note: OpenVSP Python API not importable (the vsp/vspscript CLI still works)"
fi

# ---------------------------------------------------------------- glTF tools (npm)
NODE_DIR="$PREFIX/node"
if [ ! -x "$NODE_DIR/node_modules/.bin/gltf-transform" ] || [ ! -x "$NODE_DIR/node_modules/.bin/gltfpack" ]; then
  log "gltf-transform, gltfpack"
  mkdir -p "$NODE_DIR"
  npm install --prefix "$NODE_DIR" --no-audit --no-fund -s @gltf-transform/cli gltfpack >/dev/null 2>&1 || fail "gltf tools (npm)"
fi
for t in gltf-transform gltfpack; do [ -x "$NODE_DIR/node_modules/.bin/$t" ] && ln -sf "$NODE_DIR/node_modules/.bin/$t" "$BIN/$t"; done
command -v gltf-transform >/dev/null 2>&1 && command -v gltfpack >/dev/null 2>&1 && ok "gltf-transform, gltfpack"

# ---------------------------------------------------------------- KTX-Software (toktx, ktx)
if ! command -v toktx >/dev/null 2>&1; then
  log "KTX-Software $KTX_VERSION"
  deb="$CACHE/KTX-Software-$KTX_VERSION-Linux-x86_64.deb"
  if fetch "https://github.com/KhronosGroup/KTX-Software/releases/download/v$KTX_VERSION/KTX-Software-$KTX_VERSION-Linux-x86_64.deb" "$deb"; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$deb" >/dev/null 2>&1 && rm -f "$deb"
  fi
fi
command -v toktx >/dev/null 2>&1 && ok "toktx/ktx $KTX_VERSION" || fail "ktx-software"

# ---------------------------------------------------------------- texture helper
# Copied next to the tools (from this checkout, or from GitHub when the script is piped from curl)
HERE=$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)
RAW=https://raw.githubusercontent.com/Hello-13/Hello-Woorld
if [ -f "$HERE/fetch-texture.py" ]; then
  cp "$HERE/fetch-texture.py" "$PREFIX/fetch-texture.py"
else
  for ref in master claude/aerospace-3d-models-gjms7d; do
    curl -fsSL --retry 3 --retry-delay 2 -o "$PREFIX/fetch-texture.py" "$RAW/$ref/tools/fetch-texture.py" 2>/dev/null && break
  done
fi
if [ -s "$PREFIX/fetch-texture.py" ]; then
  printf '#!/bin/sh\nexec %s %s "$@"\n' "$BIN/py3d" "$PREFIX/fetch-texture.py" > "$BIN/fetch-texture" && chmod +x "$BIN/fetch-texture" && ok "fetch-texture"
else
  fail "fetch-texture (helper not found)"
fi

# ---------------------------------------------------------------- session environment
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export BLENDER=$BIN/blender" >> "$CLAUDE_ENV_FILE"
fi

log "ready: ${READY[*]:-none}"
[ ${#FAILED[@]} -gt 0 ] && log "failed: ${FAILED[*]}"
exit 0
