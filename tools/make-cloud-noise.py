#!/usr/bin/env python3
"""Builds the tileable 3-D noise volumes the volumetric clouds are carved from (aeroforge/src/engine/skyvol.js).

  py3d tools/make-cloud-noise.py            → aeroforge/assets/sky/cloud-shape.png, cloud-detail.png

cloud-shape.png   128³ voxels as a 16 × 8 atlas of 128² slices (2048 × 1024)
    R  Perlin-Worley: gradient fbm dilated by cellular noise, the billowy base shape
    G  cellular (Worley) fbm at three octaves, 1 at the cell centres: erodes the base into lobes
    B  a second, independent gradient fbm: cloud type / height variation and wisps
cloud-detail.png  64³ voxels as an 8 × 8 atlas of 64² slices (512 × 512)
    R, G, B  cellular fbm at three seeds: the fine erosion at the cloud edges

Every volume tiles in x, y and z. The method follows Schneider's "Real-time volumetric cloudscapes
of Horizon Zero Dawn" (SIGGRAPH 2015) and Hillaire's TileableVolumeNoise.
"""
import os
import sys

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "aeroforge", "assets", "sky")


def grid(n):
    a = (np.arange(n, dtype=np.float32) + 0.5) / n
    return np.meshgrid(a, a, a, indexing="ij")          # x, y, z in [0, 1)


def perlin(n, freq, seed):
    """Tileable 3-D gradient noise with `freq` lattice cells per side, about -1..1."""
    rng = np.random.default_rng(seed)
    g = rng.normal(size=(freq, freq, freq, 3)).astype(np.float32)
    g /= np.linalg.norm(g, axis=-1, keepdims=True)
    x, y, z = (c * freq for c in grid(n))
    xi, yi, zi = (np.floor(c).astype(np.int32) for c in (x, y, z))
    xf, yf, zf = x - xi, y - yi, z - zi
    fade = lambda t: t * t * t * (t * (t * 6 - 15) + 10)
    u, v, w = fade(xf), fade(yf), fade(zf)
    out = np.zeros_like(x)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                gr = g[(xi + dx) % freq, (yi + dy) % freq, (zi + dz) % freq]
                d = gr[..., 0] * (xf - dx) + gr[..., 1] * (yf - dy) + gr[..., 2] * (zf - dz)
                wx = u if dx else 1 - u
                wy = v if dy else 1 - v
                wz = w if dz else 1 - w
                out += d * wx * wy * wz
    return out * 1.5


def perlin_fbm(n, freq, octaves, seed, gain=0.5):
    out = np.zeros((n, n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * perlin(n, freq * 2 ** o, seed + 17 * o)
        tot += amp
        amp *= gain
    return np.clip(out / tot * 0.5 + 0.5, 0, 1)


def worley(n, cells, seed):
    """Tileable cellular noise, inverted: 1 at a feature point, 0 far from all of them."""
    rng = np.random.default_rng(seed)
    pts = rng.random((cells, cells, cells, 3)).astype(np.float32)
    x, y, z = (c * cells for c in grid(n))
    xi, yi, zi = (np.floor(c).astype(np.int32) for c in (x, y, z))
    best = np.full(x.shape, 1e9, np.float32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx, cy, cz = xi + dx, yi + dy, zi + dz
                p = pts[cx % cells, cy % cells, cz % cells]
                d = (cx + p[..., 0] - x) ** 2 + (cy + p[..., 1] - y) ** 2 + (cz + p[..., 2] - z) ** 2
                best = np.minimum(best, d)
    return 1 - np.clip(np.sqrt(best), 0, 1)


def worley_fbm(n, cells, seed):
    return worley(n, cells, seed) * 0.625 + worley(n, cells * 2, seed + 1) * 0.25 + worley(n, cells * 4, seed + 2) * 0.125


def remap(v, lo, hi, a, b):
    return a + (v - lo) / (hi - lo) * (b - a)


def atlas(vol, cols):
    """vol[x, y, z, c] (uint8) → an image of z-slices, `cols` across; pixel (x, y) of slice z."""
    n = vol.shape[0]
    rows = n // cols
    img = np.zeros((rows * n, cols * n, 3), np.uint8)
    for z in range(n):
        r, c = divmod(z, cols)
        img[r * n:(r + 1) * n, c * n:(c + 1) * n] = np.transpose(vol[:, :, z, :], (1, 0, 2))
    return img


def u8(v):
    return np.clip(np.round(v * 255), 0, 255).astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    n = 128
    pf = perlin_fbm(n, 4, 5, seed=11, gain=0.55)
    pf = np.clip((pf - 0.5) * 1.9 + 0.5, 0, 1)                         # spread the fbm over the range
    w0, w1, w2 = worley_fbm(n, 4, 31), worley_fbm(n, 8, 41), worley_fbm(n, 16, 51)
    pw = np.clip(remap(pf, 0.0, 1.0, w0 * 0.75, 1.0), 0, 1)              # Perlin-Worley
    pw = np.clip(remap(pw, pw.min(), pw.max(), 0, 1), 0, 1)
    wf = np.clip(w0 * 0.625 + w1 * 0.25 + w2 * 0.125, 0, 1)
    pf2 = perlin_fbm(n, 3, 5, seed=73, gain=0.5)
    pf2 = np.clip((pf2 - 0.5) * 2.0 + 0.5, 0, 1)
    shape = np.stack([u8(pw), u8(wf), u8(pf2)], axis=-1)
    Image.fromarray(atlas(shape, 16)).save(os.path.join(OUT, "cloud-shape.png"), optimize=True)

    m = 64
    det = np.stack([u8(worley_fbm(m, 3, 101)), u8(worley_fbm(m, 4, 111)), u8(worley_fbm(m, 6, 121))], axis=-1)
    Image.fromarray(atlas(det, 8)).save(os.path.join(OUT, "cloud-detail.png"), optimize=True)
    for name, v in (("perlin-worley", pw), ("worley fbm", wf), ("perlin 2", pf2)):
        print(f"{name}: min {v.min():.3f} mean {v.mean():.3f} max {v.max():.3f}")
    for f in ("cloud-shape.png", "cloud-detail.png"):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "kB")


if __name__ == "__main__":
    sys.exit(main())
