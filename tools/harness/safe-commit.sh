#!/bin/bash
# Commit the working tree's changes only if they pass, and commit exactly the copies that were tested
# (agents may still be editing): the changed files are copied into a clean worktree at HEAD, checked
# there (node --check, module link check, npm test in aeroforge), and those blobs are committed and pushed.
# Usage: tools/harness/safe-commit.sh [exclude-regex] [message]     (exclude '^$' = nothing)
set -uo pipefail
REPO=$(git rev-parse --show-toplevel); HERE="$REPO/tools/harness"
EXCL=${1:-'^$'}; MSG=${2:-Checkpoint work in progress}
cd "$REPO"
mapfile -t CH < <(git ls-files -m -o --exclude-standard | sort -u | grep -Ev "$EXCL" || true)
mapfile -t DEL < <(git ls-files -d | grep -Ev "$EXCL" || true)
if [ ${#CH[@]} -eq 0 ] && [ ${#DEL[@]} -eq 0 ]; then echo clean; exit 0; fi
WT=$(mktemp -d); git worktree add --detach -q "$WT" HEAD
trap 'git worktree remove --force "$WT" >/dev/null 2>&1' EXIT
KEEP=()
for f in "${CH[@]}"; do
  [ -f "$f" ] || continue                      # deleted files are listed as modified too
  mkdir -p "$WT/$(dirname "$f")"; cp -p "$f" "$WT/$f"; KEEP+=("$f")
done
for f in "${DEL[@]}"; do git -C "$WT" rm -q -- "$f" >/dev/null 2>&1; done
for f in "${KEEP[@]}"; do case "$f" in *.js|*.mjs) node --check "$WT/$f" || { echo "syntax error in $f, not committing"; exit 1; };; esac; done
if ! out=$(node --import "$HERE/linkcheck/register.mjs" "$HERE/linkcheck/check.mjs" "$WT/aeroforge" 2>&1); then echo "$out" | tail -5; echo "modules do not link, not committing"; exit 1; fi
out=$(cd "$WT/aeroforge" && npm test 2>&1); pass=$(echo "$out" | grep -E '^# pass' | head -1)
if ! echo "$out" | grep -qE '^# fail 0$'; then echo "tests fail, not committing"; echo "$out" | grep -E '^not ok|error:' | head -8; exit 1; fi
for f in "${KEEP[@]}"; do
  mode=100644; [ -x "$WT/$f" ] && mode=100755
  git update-index --add --cacheinfo "$mode,$(git hash-object -w "$WT/$f"),$f"
done
for f in "${DEL[@]}"; do git update-index --force-remove "$f"; done
git commit -q -m "$MSG

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018zFygYc2Gud11MTgsF4AqQ" || { echo "nothing to commit"; exit 0; }
BR=$(git rev-parse --abbrev-ref HEAD)
for d in 0 2 4 8 16; do sleep $d; git push -q -u origin "$BR" && break; done
echo "committed $(git rev-parse --short HEAD): $(( ${#KEEP[@]} + ${#DEL[@]} )) files; $pass"
