#!/bin/bash
# Build the artifact snapshot of AEROFORGE: tools/harness/make-snap.sh <git rev | WORK> <empty out dir>
# The page becomes aeroforge.html (index.html without its doctype/html/head/body/meta charset+viewport, which
# the artifact host supplies); the EXR light probes ship as base64 text (EXR is not a served type there) and
# environment.js is patched to read them.
set -euo pipefail
REV=${1:?rev}; OUT=${2:?out dir}
REPO=$(git rev-parse --show-toplevel)
mkdir -p "$OUT"
if [ "$REV" = WORK ]; then
  cp -r "$REPO/aeroforge/src" "$REPO/aeroforge/styles.css" "$REPO/aeroforge/index.html" "$OUT/"
else
  git -C "$REPO" archive "$REV" aeroforge/src aeroforge/styles.css aeroforge/index.html | tar -x -C "$OUT" --strip-components=1
fi
mkdir -p "$OUT/assets/hdri" "$OUT/assets/earth"
cp "$REPO"/aeroforge/assets/earth/* "$OUT/assets/earth/"
for f in "$REPO"/aeroforge/assets/hdri/*; do
  case "$f" in
    *.exr) base64 -w0 "$f" > "$OUT/assets/hdri/$(basename "$f").txt" ;;
    *) cp "$f" "$OUT/assets/hdri/" ;;
  esac
done
for d in "$REPO"/aeroforge/assets/*/; do
  n=$(basename "$d"); case "$n" in hdri|earth) ;; *) cp -r "$d" "$OUT/assets/$n" ;; esac
done
python3 - "$OUT" <<'PY'
import re, sys
out = sys.argv[1]
p = out + '/src/engine/environment.js'; s = open(p).read()
old = "const p = this.exr.loadAsync(`assets/hdri/${name}.exr`).then((t) => {"
assert s.count(old) == 1, 'environment.js: EXR loader line not found exactly once'
new = """// artifact build: HDRIs ship as base64 text (EXR is not a served type there)
    const p = fetch(`assets/hdri/${name}.exr.txt`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((b64) => {
      const bin = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
      const d = this.exr.parse(bin.buffer);
      const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type);
      if (d.colorSpace) t.colorSpace = d.colorSpace;
      if (d.flipY !== undefined) t.flipY = d.flipY;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    }).then((t) => {"""
open(p, 'w').write(s.replace(old, new))
h = open(out + '/index.html').read()
h = re.sub(r'<!doctype[^>]*>\s*', '', h, flags=re.I)
h = re.sub(r'</?(html|head|body)\b[^>]*>\s*', '', h, flags=re.I)
h = re.sub(r'<meta\s+(charset|name="viewport")[^>]*>\s*', '', h, flags=re.I)
open(out + '/aeroforge.html', 'w').write(h)
import os; os.remove(out + '/index.html')
PY
echo "snapshot at $OUT: $(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1)"
