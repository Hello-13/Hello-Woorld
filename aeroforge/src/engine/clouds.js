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
import { WRAP, TILES, DRIFT_WRAP, NOISE_SIZE, tileableFbm, tileableWorley } from './skymath.js';

export { WRAP, TILES, DRIFT_WRAP, NOISE_SIZE };

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
  const float T_CIRRUS = ${TILES.cirrus.toFixed(1)};
  const float T_CFIBRE = ${TILES.cirrusFibre.toFixed(1)};
  const float T_CFINE = ${TILES.cirrusFine.toFixed(1)};
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
    float thr = 0.69 - coverage * 0.34 + (0.5 - reg.x) * 0.4;     // half the field at coverage 0.55
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
