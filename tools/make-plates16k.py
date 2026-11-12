#!/usr/bin/env python3
"""Builds the 16K backdrop bands for the hangar and launch-pad looks.

  py3d -I tools/make-plates16k.py <poly-haven 16k .hdr> <existing 8k plate .jpg> <out prefix>
  e.g.   ... empty_warehouse_01_16k.hdr aeroforge/assets/hdri/warehouse-8k.jpg aeroforge/assets/hdri/warehouse-16k

Writes <prefix>-a.jpg and <prefix>-b.jpg: the left and right halves (8192 x 3200 each) of the
panorama's central band, elevations within +/-35.16 degrees, at 16384 pixels round the horizon
(45.5 pixels per degree, twice the 8K plate). environment.js draws the band over the 8K plate.

The band must look exactly like the 8K plate it sits in, which is Poly Haven's own tone-mapped
JPG. So the 16K HDR only supplies the detail the 8K plate cannot hold: a per-channel tone curve
is fitted from the HDR (reduced to 8K) to the plate, the 16K HDR is put through it, and what that
image has above the 8K plate's resolution (itself minus itself reduced to 8K and enlarged again)
is added to the enlarged plate. Colours and tones therefore stay the plate's.
"""
import sys

import cv2
import numpy as np

BAND = 3200          # rows of the 16K panorama kept, centred on the horizon


def fit_curve(hdr8, jpg8):
    """Per channel: mean plate value for each of 2048 bins of log2 radiance, made monotone."""
    luts = []
    for c in range(3):
        x = np.log2(np.maximum(hdr8[..., c], 1e-6)).ravel()
        y = jpg8[..., c].ravel()
        lo, hi = np.percentile(x, 0.01), np.percentile(x, 99.99)
        idx = np.clip(((x - lo) / (hi - lo) * 2047).astype(np.int32), 0, 2047)
        s = np.bincount(idx, weights=y, minlength=2048)
        n = np.bincount(idx, minlength=2048)
        m = np.where(n > 0, s / np.maximum(n, 1), np.nan)
        ok = ~np.isnan(m)
        m = np.interp(np.arange(2048), np.flatnonzero(ok), m[ok])
        m = np.maximum.accumulate(m)
        luts.append((lo, hi, m.astype(np.float32)))
    return luts


def apply_curve(img, luts):
    out = np.empty_like(img)
    for c, (lo, hi, m) in enumerate(luts):
        x = np.log2(np.maximum(img[..., c], 1e-6))
        out[..., c] = np.interp(x, np.linspace(lo, hi, 2048), m)
    return out


def main():
    hdr_path, plate_path, prefix = sys.argv[1:4]
    hdr = cv2.imread(hdr_path, cv2.IMREAD_UNCHANGED)          # BGR float32
    assert hdr is not None and hdr.shape[1] == 16384, hdr_path
    plate = cv2.imread(plate_path, cv2.IMREAD_COLOR).astype(np.float32) / 255.0
    assert plate.shape[:2] == (4096, 8192), plate.shape
    hdr8 = cv2.resize(hdr, (8192, 4096), interpolation=cv2.INTER_AREA)
    luts = fit_curve(hdr8, plate)
    err = np.abs(apply_curve(hdr8, luts) - plate)
    print(f"tone curve: mean abs error {err.mean() * 255:.2f} / 255, 99th percentile {np.percentile(err, 99) * 255:.1f}")
    del hdr8

    r0 = hdr.shape[0] // 2 - BAND // 2
    band = np.ascontiguousarray(hdr[r0:r0 + BAND])
    del hdr
    hi = apply_curve(band, luts)
    del band
    low = cv2.resize(cv2.resize(hi, (8192, BAND // 2), interpolation=cv2.INTER_AREA), (16384, BAND), interpolation=cv2.INTER_CUBIC)
    detail = hi - low
    del hi, low
    base = cv2.resize(plate[r0 // 2:r0 // 2 + BAND // 2], (16384, BAND), interpolation=cv2.INTER_CUBIC)
    out = np.clip(base + detail, 0, 1)
    print(f"detail added: rms {np.sqrt((detail ** 2).mean()) * 255:.2f} / 255")
    out8 = np.clip(np.round(out * 255), 0, 255).astype(np.uint8)
    params = [cv2.IMWRITE_JPEG_QUALITY, 90, cv2.IMWRITE_JPEG_SAMPLING_FACTOR, cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444]
    for name, half in (("a", out8[:, :8192]), ("b", out8[:, 8192:])):
        cv2.imwrite(f"{prefix}-{name}.jpg", half, params)
        print(f"{prefix}-{name}.jpg")


if __name__ == "__main__":
    main()
