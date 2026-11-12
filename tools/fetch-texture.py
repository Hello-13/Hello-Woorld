#!/usr/bin/env python3
"""Search and download CC0 PBR materials and HDRIs from ambientCG and Poly Haven.

  fetch-texture search concrete                      both libraries, most popular first
  fetch-texture search "brushed metal" --source polyhaven
  fetch-texture get Concrete034 --res 2k --out assets/textures/concrete
  fetch-texture get rusty_metal_02 --source polyhaven --res 4k --out assets/textures/rust
  fetch-texture hdri industrial_workshop_foundry --res 4k --out assets/hdri

Everything on both sites is CC0 (no attribution required); the script still writes a
SOURCE.txt next to the files with the asset page, so credits can be listed. Downloads go into
--out (a new directory is fine); zip members are extracted by base name only.
"""
import argparse
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile

UA = {"User-Agent": "aeroforge-tools/1.0"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def get_json(url):
    return json.loads(get(url))


def save(out, name, data):
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, os.path.basename(name))
    with open(path, "wb") as f:
        f.write(data)
    print(path)


def note(out, text):
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "SOURCE.txt"), "a") as f:
        f.write(text + "\n")


# ------------------------------------------------------------------ ambientCG
def acg_search(q, limit):
    url = "https://ambientcg.com/api/v2/full_json?" + urllib.parse.urlencode(
        {"q": q, "type": "Material", "sort": "Popular", "limit": limit})
    for a in get_json(url).get("foundAssets", []):
        print(f"ambientcg  {a['assetId']:<28} {a.get('displayName', '')}")


def acg_get(asset, res, fmt, out):
    res = res.upper()
    fmt = {"jpg": "JPG", "png": "PNG"}.get(fmt.lower(), "JPG")
    data = get(f"https://ambientcg.com/get?file={asset}_{res}-{fmt}.zip")
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for m in z.infolist():
            if not m.is_dir():
                save(out, m.filename, z.read(m))
    note(out, f"{asset} ({res}-{fmt}) from ambientCG, CC0: https://ambientcg.com/view?id={asset}")


# ------------------------------------------------------------------ Poly Haven
def ph_search(q, limit, kind="textures"):
    assets = get_json(f"https://api.polyhaven.com/assets?t={kind}")
    words = q.lower().split()
    hits = []
    for aid, a in assets.items():
        hay = " ".join([aid, a.get("name", "")] + a.get("tags", []) + a.get("categories", [])).lower()
        if all(w in hay for w in words):
            hits.append((a.get("download_count", 0), aid, a.get("name", "")))
    for _, aid, name in sorted(hits, reverse=True)[:limit]:
        print(f"polyhaven  {aid:<28} {name}")


def ph_get(asset, res, fmt, out):
    files = get_json(f"https://api.polyhaven.com/files/{asset}")
    res = res.lower()
    got = 0
    for mapname, by_res in files.items():
        if mapname in ("blend", "gltf", "mtlx") or not isinstance(by_res, dict) or res not in by_res:
            continue
        formats = by_res[res]
        f = formats.get(fmt) or formats.get("jpg") or formats.get("png") or next(iter(formats.values()), None)
        if isinstance(f, dict) and "url" in f:
            save(out, f["url"].split("/")[-1], get(f["url"]))
            got += 1
    if not got:
        sys.exit(f"no {res} maps for {asset}; resolutions: {sorted({r for v in files.values() if isinstance(v, dict) for r in v})}")
    note(out, f"{asset} ({res}) from Poly Haven, CC0: https://polyhaven.com/a/{asset}")


def ph_hdri(asset, res, fmt, out):
    files = get_json(f"https://api.polyhaven.com/files/{asset}")["hdri"]
    f = files[res.lower()].get(fmt if fmt in ("exr", "hdr") else "exr") or files[res.lower()]["hdr"]
    save(out, f["url"].split("/")[-1], get(f["url"]))
    note(out, f"{asset} HDRI ({res}) from Poly Haven, CC0: https://polyhaven.com/a/{asset}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["search", "get", "hdri"])
    ap.add_argument("query")
    ap.add_argument("--source", choices=["ambientcg", "polyhaven", "both"], default=None)
    ap.add_argument("--res", default="2k", help="1k, 2k, 4k, 8k")
    ap.add_argument("--format", default="jpg", help="jpg or png (maps); exr or hdr (HDRIs)")
    ap.add_argument("--out", default=".")
    ap.add_argument("--limit", type=int, default=12)
    a = ap.parse_args()
    if a.cmd == "search":
        src = a.source or "both"
        if src in ("ambientcg", "both"):
            acg_search(a.query, a.limit)
        if src in ("polyhaven", "both"):
            ph_search(a.query, a.limit)
    elif a.cmd == "get":
        (ph_get if a.source == "polyhaven" else acg_get)(a.query, a.res, a.format, a.out)
    else:
        ph_hdri(a.query, a.res, "exr" if a.format == "jpg" else a.format, a.out)


if __name__ == "__main__":
    main()
