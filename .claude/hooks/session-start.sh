#!/bin/bash
# Claude Code cloud sessions: make sure the 3-D toolchain (tools/install-3d-tools.sh) and the
# root project's npm dependencies are present. Idempotent; quick when everything is installed.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
bash tools/install-3d-tools.sh
[ -f package.json ] && npm install --no-audit --no-fund >/dev/null 2>&1 || true
