// The cloud field for the open-sky deck (sky.js): a tileable noise texture built at run time and
// the GLSL that turns it into a stratocumulus / cumulus field with a top-height in metres.
//
// Texture (512², RGBA, mip-mapped, anisotropic):
//   r, g, b  gradient (Perlin) fbm with different seeds and base frequencies
//   a        cellular (Worley) noise, inverted and domed: 1 at a cell's centre, 0 on its walls. Ten
//            cells per tile, so the same channel gives 1.5 km convection cells at the 15 km tile,
//            300 m lumps at the 3 km tile and 60 m cauliflower at the 600 m tile.
//
// Every tile size divides 90 000 m (the scroll's wrap period) and every drift offset wraps on its
// own tile, so nothing pops when the counters wrap. The lattices are sampled unrotated: rotating a
// periodic lookup breaks that wrap, and the channels are already uncorrelated across scales.

import * as THREE from 'three';
import { rng } from './materials.js';

export const NOISE_SIZE = 512;
/** The scroll wraps here (m); every tile below divides it. */
export const WRAP = 90000;
export const TILES = { region: 90000, land: 45000, tower: 30000, cells: 15000, mid: 3000, fine: 600, detail: 120, cirrusMask: 90000, cirrus: 45000 };
/** The drift vectors wrap on the tile they offset (m). */
export const DRIFT_WRAP = { mid: TILES.mid, cells: TILES.cells };

// Tileable gradient (Perlin) noise summed over octaves, each octave's lattice shifted by a random
// phase, so no grid shows through.
function tileableFbm(size, { seed = 1, octaves = 7, base = 4, gain = 0.5 } = {}) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    if (cells > size) break;
    const gx = new Float32Array(cells * cells), gy = new Float32Array(cells * cells);
    for (let i = 0; i < gx.length; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    const ox = r() * cells, oy = r() * cells;
    const scale = cells / size;
    for (let y = 0; y < size; y++) {
      const fy = y * scale + oy, y0 = Math.floor(fy), ty = fy - y0, sy = fade(ty);
      const ya = ((y0 % cells) + cells) % cells, yb = (ya + 1) % cells;
      for (let x = 0; x < size; x++) {
        const fx = x * scale + ox, x0 = Math.floor(fx), tx = fx - x0, sx = fade(tx);
        const xa = ((x0 % cells) + cells) % cells, xb = (xa + 1) % cells;
        const i00 = ya * cells + xa, i10 = ya * cells + xb, i01 = yb * cells + xa, i11 = yb * cells + xb;
        const n00 = gx[i00] * tx + gy[i00] * ty, n10 = gx[i10] * (tx - 1) + gy[i10] * ty;
        const n01 = gx[i01] * tx + gy[i01] * (ty - 1), n11 = gx[i11] * (tx - 1) + gy[i11] * (ty - 1);
        const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
        out[y * size + x] += amp * (nx0 + (nx1 - nx0) * sy);
      }
    }
    amp *= gain;
  }
  return normalize(out);
}

// Tileable cellular noise: the distance to the nearest of `cells`² jittered feature points, turned
// into a domed bump per cell (1 at the point, 0 at the walls), plus a half-weight second layer at
// twice the frequency so the cells have sub-structure.
function tileableWorley(size, { seed = 5, cells = 10 } = {}) {
  const out = new Float32Array(size * size);
  const layer = (n, amp, sd) => {
    const r = rng(sd);
    const px = new Float32Array(n * n), py = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) { px[i] = (i % n) + 0.15 + r() * 0.7; py[i] = Math.floor(i / n) + 0.15 + r() * 0.7; }
    const scale = n / size, r0 = 0.72;    // a cell's dome reaches r0 cell widths
    for (let y = 0; y < size; y++) {
      const fy = y * scale, cy = Math.floor(fy);
      for (let x = 0; x < size; x++) {
        const fx = x * scale, cx = Math.floor(fx);
        let best = 1e9;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const gx = ((cx + i) % n + n) % n, gy = ((cy + j) % n + n) % n;
          const k = gy * n + gx;
          const dx = fx - (px[k] + (cx + i - gx)), dy = fy - (py[k] + (cy + j - gy));
          const d2 = dx * dx + dy * dy;
          if (d2 < best) best = d2;
        }
        const d = Math.min(Math.sqrt(best) / r0, 1);
        const dome = 1 - d * d;             // round tops, not cones
        out[y * size + x] += amp * dome * dome * (3 - 2 * dome);
      }
    }
  };
  layer(cells, 1.0, seed);
  layer(cells * 2, 0.45, seed + 11);
  return normalize(out);
}

function normalize(out) {
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, 1e-6);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / span;
  return out;
}

let noiseTex = null;
/** The cloud noise texture (built once, ~0.4 s on the main thread). */
export function cloudNoise() {
  if (noiseTex) return noiseTex;
  const s = NOISE_SIZE;
  const r = tileableFbm(s, { seed: 21, octaves: 7, base: 3, gain: 0.55 });
  const g = tileableFbm(s, { seed: 47, octaves: 7, base: 2, gain: 0.52 });
  const b = tileableFbm(s, { seed: 83, octaves: 6, base: 6, gain: 0.6 });
  const a = tileableWorley(s, { seed: 5, cells: 10 });
  const data = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i++) {
    data[i * 4] = Math.round(r[i] * 255);
    data[i * 4 + 1] = Math.round(g[i] * 255);
    data[i * 4 + 2] = Math.round(b[i] * 255);
    data[i * 4 + 3] = Math.round(a[i] * 255);
  }
  const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

/** The raw noise field, for tests and tools (a Float32Array per channel). */
export function cloudNoiseChannels(size = 128) {
  return {
    r: tileableFbm(size, { seed: 21, octaves: 5, base: 3, gain: 0.55 }),
    a: tileableWorley(size, { seed: 5, cells: 10 }),
  };
}

// ------------------------------------------------------------------------------- GLSL
// The cloud field. Needs these uniforms in the including shader:
//   sampler2D noiseTex; float coverage, hAmp, towerAmp, detail; vec2 drift1, drift2
// Ground coordinates q are metres, already scrolled; foot is the pixel's footprint on the deck (m).
export const CLOUD_FIELD_GLSL = /* glsl */`
  const float T_REGION = ${TILES.region.toFixed(1)};
  const float T_LAND = ${TILES.land.toFixed(1)};
  const float T_TOWER = ${TILES.tower.toFixed(1)};
  const float T_CELLS = ${TILES.cells.toFixed(1)};
  const float T_MID = ${TILES.mid.toFixed(1)};
  const float T_FINE = ${TILES.fine.toFixed(1)};
  const float T_DETAIL = ${TILES.detail.toFixed(1)};
  const float NOISE_PX = ${NOISE_SIZE.toFixed(1)};

  // A noise sample at a tile size (m) with its mip level chosen from the pixel's footprint on
  // the deck (m), not from screen derivatives: the same filtering on every GPU, no shimmer at
  // grazing angles and nothing undefined at the horizon branch.
  vec4 nz(vec2 q, float tile, float foot) {
    return textureLod(noiseTex, q / tile, log2(max(foot * NOISE_PX / tile, 1.0)) + 0.5);
  }

  // The large scales, evaluated once per pixel: big open / closed regions (0..1) and the towering
  // cumulus mask (0..1, rare).
  vec2 fieldRegion(vec2 q, float foot) {
    float big = nz(q + 0.37 * T_REGION, T_REGION, foot).g;
    float tw = towers * smoothstep(0.72, 0.9, nz(q + 9000.0, T_TOWER, foot).r);
    return vec2(big, tw);
  }

  // The coarse field (two fetches): x = coverage 0..1, y = top height (m), z = the cell dome 0..1.
  // The convection cells come from the Worley channel at 1.5 km and 300 m; the fbm channels open
  // and close the field between them.
  vec3 fieldCoarse(vec2 q, float foot, vec2 reg) {
    vec4 A = nz(q + drift2, T_CELLS, foot);
    vec4 M = nz(q + drift1, T_MID, foot);
    float f = A.r * 0.5 + M.g * 0.32 + A.a * 0.18;
    float thr = 0.64 - coverage * 0.34 + (0.5 - reg.x) * 0.4;
    float cov = smoothstep(thr - 0.03, thr + 0.1, f);      // a narrow transition: distinct cells and gaps, not grey mush
    float lump = A.a * 0.75 + M.a * 0.25;
    float h = cov * (0.28 + 0.47 * lump + 0.25 * M.g) * hAmp;
    h += reg.y * cov * (0.4 + 0.6 * A.a) * towerAmp;       // the towers stand on the cells
    return vec3(cov, h, lump);
  }

  // The full field (three to four more fetches): the fine scales roughen the coverage edges and
  // put the cauliflower on the tops. Used at the hit point and for the shading normal only.
  vec3 fieldFull(vec2 q, float foot, vec2 reg) {
    vec3 c = fieldCoarse(q, foot, reg);
    vec4 F = nz(q + drift1 + 211.0, T_FINE, foot);
    float edge = smoothstep(0.0, 0.35, c.x);
    float cov = clamp(c.x + (F.b - 0.5) * 0.35 * edge, 0.0, 1.0);
    float h = c.y + ((F.a - 0.5) * 0.055 + (F.b - 0.5) * 0.03) * hAmp * cov;   // bumps about a third as high as they are wide
    if (detail > 0.5) {
      float f2 = nz(q + drift1 + 55.0, T_DETAIL, foot).a;
      h += (f2 - 0.5) * 0.012 * hAmp * cov;
    }
    return vec3(cov, h, c.z);
  }
`;
