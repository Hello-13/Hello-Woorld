// Procedural surface library: tileable fBm noise, height-to-normal conversion and PBR map sets
// (albedo / roughness / normal) for aircraft skins, rocket tankage, MLI, carbon, concrete and
// heat-tinted metal. Everything is painted on canvases at load time — no image downloads.

import * as THREE from 'three';
import { rng } from './materials.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) { const t0 = performance.now(); cache.set(key, make()); (globalThis.__texMs ??= {})[key] = Math.round(performance.now() - t0); }   // TEMP-TIMING
  return cache.get(key);
};

// ------------------------------------------------------------------------------- noise
/** Tileable value-noise fBm field (Float32Array, size×size, values ≈ 0..1). */
export function fbm(size, { seed = 1, octaves = 5, base = 4, gain = 0.5 } = {}) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = r();
    const scale = cells / size;
    for (let y = 0; y < size; y++) {
      const fy = y * scale, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % cells) * cells, yb = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const fx = x * scale, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells, xb = (x0 + 1) % cells;
        const a = lattice[ya + xa], b = lattice[ya + xb], c = lattice[yb + xa], d = lattice[yb + xb];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy);
      }
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Resolution multiplier for the large procedural skins and the decals: 2 at Ultra / 4K so panel
// lines, fasteners and stencils stay sharp in close-ups on 4K screens.
let DETAIL = 1;
// crisp: distance-field edges for decals and skin seams plus micro-detail in close-ups (FX.crisp, ?crisp=0 turns the
// shader side off; the maps are then used exactly as painted)
let CRISP = true;
export function setTextureDetail(k, { crisp = true } = {}) { DETAIL = k; CRISP = !!crisp; }
export const crispOn = () => CRISP;
/** The resolution multiple the large maps are painted at (1, or 2 on Ultra / 4K). */
export const textureDetail = () => DETAIL;
// the close-up extras are built on the presets that paint at the higher detail (Ultra, 4K): nothing extra on the others
const FINE = () => CRISP && DETAIL >= 2;

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// The map canvases are painted once, read back (normal maps, distance fields) and drawn into one another, so
// they are kept in main memory: a GPU-backed canvas would cost a synchronous read-back at each of those steps.
const CPU = { willReadFrequently: true };

/** Write a scalar field into a canvas as grey (0..1 → 0..255), optionally mapped through fn. */
function fieldToCanvas(field, size, fn = (v) => v) {
  const c = canvas(size);
  const ctx = c.getContext('2d', CPU);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(255, fn(field[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Height canvas (grey) → tangent-space normal-map canvas via a wrapped Sobel filter. */
export function heightToNormal(src, strength = 2) {
  const w = src.width, h = src.height;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const c = canvas(w, h);
  const ctx = c.getContext('2d', CPU);
  const img = ctx.createImageData(w, h);
  const out = img.data, k = strength / 255;
  for (let y = 0; y < h; y++) {
    const r0 = ((y + h - 1) % h) * w * 4, r1 = y * w * 4, r2 = ((y + 1) % h) * w * 4;
    for (let x = 0; x < w; x++) {
      const xl = ((x + w - 1) % w) * 4, xr = ((x + 1) % w) * 4, xc = x * 4;
      const a = data[r0 + xl], b = data[r0 + xc], cc = data[r0 + xr], d = data[r1 + xl], f = data[r1 + xr], g = data[r2 + xl], hh = data[r2 + xc], ii = data[r2 + xr];
      let nx = -((cc + 2 * f + ii) - (a + 2 * d + g)) * k, ny = ((g + 2 * hh + ii) - (a + 2 * b + cc)) * k;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = r1 + xc;
      out[i] = (nx * l * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * l * 0.5 + 0.5) * 255;
      out[i + 2] = (l * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Build a { map, roughnessMap, normalMap } set from albedo/height/roughness painters.
 *  hires: paint albedo and height at the DETAIL multiple (painters keep logical coordinates). */
function mapSet(key, size, { albedo, height, rough, normalStrength = 2, repeat = [1, 1], hires = false, detail = null }) {
  return once(key, () => {
    const k = hires ? DETAIL : 1;
    const paint = (fn, scale) => {
      const c = canvas(size * scale);
      const ctx = c.getContext('2d', CPU);
      ctx.scale(scale, scale);
      fn?.(ctx, size, scale);
      return c;
    };
    const a = paint(albedo, k), hgt = paint(height, k), rg = paint(rough, 1);
    const set = {
      map: albedo ? tex(a, { srgb: true, repeat }) : null,
      roughnessMap: tex(rg, { repeat }),
      // the Sobel gradient is per pixel, so a finer canvas needs a proportionally stronger filter
      normalMap: tex(heightToNormal(hgt, normalStrength * k), { repeat }),
    };
    if (detail) closeUpDetail(set.normalMap, hgt, detail);
    return set;
  });
}

// ------------------------------------------------------------------------------- painters
const grime = (size, seed, lo, hi) => fieldToCanvas(fbm(size, { seed, octaves: 6, base: 3 }), size, (v) => lo + (hi - lo) * v);

/**
 * Aircraft skin tile (2 m × 2 m at repeat 1): access-panel seams with sawtooth edges,
 * fastener rows, slight paint mottling. Height: seams cut in (dark), fasteners raised.
 * The tone variation is a soft fBm mottle only (no hard-edged patches: real paint is one
 * uniform matte coat) and the relief is shallow, so panel lines read flush and subtle.
 */
export function aircraftSkin({ seed = 7, tile = 512, sawtooth = true, rivets = true } = {}) {
  return mapSet(`skin.${seed}.${sawtooth}.${rivets}`, tile, {
    hires: true,
    // close-ups: the seams (#5e on #80) and fastener heads (#94 / #9a) are redrawn sharp from a distance field
    detail: { micro: 'paint', cut: 0x80 - 0x5e, raised: 0x94 - 0x80 },
    albedo(ctx, s) {
      ctx.drawImage(grime(s, seed, 0.9, 1.0), 0, 0);
      // a second, broader mottle (weathering, overspray) at low contrast
      ctx.globalAlpha = 0.4;
      ctx.drawImage(fieldToCanvas(fbm(s, { seed: seed + 3, octaves: 3, base: 2 }), s, (v) => 0.88 + 0.12 * v), 0, 0);
      ctx.globalAlpha = 1;
    },
    height(ctx, s) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      const r = rng(seed);
      ctx.strokeStyle = '#5e5e5e';
      ctx.lineWidth = Math.max(1.5, s / 340);
      const cols = 3, rows = 2;
      for (let i = 0; i <= cols; i++) {
        const x = (i / cols) * s + (i % cols ? (r() - 0.5) * s * 0.06 : 0);
        ctx.beginPath();
        for (let y = 0; y <= s; y += s / 32) {
          const zig = sawtooth && i % 2 ? ((y / (s / 32)) % 2 ? 1 : -1) * s * 0.012 : 0;
          if (y === 0) ctx.moveTo(x + zig, y); else ctx.lineTo(x + zig, y);
        }
        ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        const y = (j / rows) * s;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      }
      // access panels with rounded corners
      for (let k = 0; k < 5; k++) {
        const w = s * (0.08 + r() * 0.14), h = s * (0.06 + r() * 0.1);
        const x = r() * (s - w), y = r() * (s - h);
        ctx.beginPath(); ctx.roundRect(x, y, w, h, s * 0.01); ctx.stroke();
        if (rivets) {
          ctx.fillStyle = '#9a9a9a';
          for (let t = 0; t <= 1.0001; t += 0.125) {
            for (const [px, py] of [[x + t * w, y - s * 0.008], [x + t * w, y + h + s * 0.008], [x - s * 0.008, y + t * h], [x + w + s * 0.008, y + t * h]]) {
              ctx.beginPath(); ctx.arc(px, py, s * 0.0028, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
      if (rivets) {
        ctx.fillStyle = '#949494';
        for (let j = 0; j <= rows; j++) {
          const y = (j / rows) * s;
          for (let x = 0; x < s; x += s / 64) { ctx.beginPath(); ctx.arc(x, y + s * 0.012, s * 0.0024, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    },
    rough(ctx, s) {
      ctx.drawImage(grime(s, seed + 9, 0.48, 0.72), 0, 0);
    },
    normalStrength: 1.0,
  });
}

/** Rocket tank skin: circumferential friction-stir welds, faint isogrid ribs, satin paint. */
export function tankSkin({ seed = 21, tile = 512 } = {}) {
  return mapSet(`tank.${seed}`, tile, {
    hires: true,
    detail: { micro: 'paint' },
    height(ctx, s) {
      ctx.drawImage(grime(s, seed, 0.47, 0.53), 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = s / 120;
      ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.lineTo(s, s * 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = s / 260;
      for (let i = 0; i < 8; i++) {
        const x = (i / 8) * s;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s / 8, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s / 8, 0); ctx.lineTo(x, s); ctx.stroke();
      }
    },
    rough(ctx, s) { ctx.drawImage(grime(s, seed + 4, 0.3, 0.46), 0, 0); },
    normalStrength: 1.4,
  });
}

/** Crinkled multi-layer insulation blanket. */
export function mliSurface({ seed = 33, tile = 512 } = {}) {
  return mapSet(`mli.${seed}`, tile, {
    hires: true,
    detail: { micro: 'foil' },
    height(ctx, s, k) {
      // painted at the canvas's real size (not scaled up), with one finer octave of creases when it is doubled
      const n = s * k, f = fbm(n, { seed, octaves: k > 1 ? 7 : 6, base: 6, gain: 0.62 });
      ctx.drawImage(fieldToCanvas(f, n, (v) => Math.abs(v - 0.5) * 2.2), 0, 0, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = s / 140;
      ctx.strokeRect(s * 0.02, s * 0.02, s * 0.96, s * 0.96);
    },
    rough(ctx, s) { ctx.drawImage(grime(s, seed + 2, 0.18, 0.42), 0, 0); },
    normalStrength: 4,
  });
}

/** 2×2 twill carbon-fibre weave. */
export function carbonWeave({ tile = 256 } = {}) {
  return mapSet('carbon', tile, {
    albedo(ctx, s) {
      const n = 16, c = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const over = ((i + j) >> 1) % 2 === 0;
        const g = ctx.createLinearGradient(i * c, j * c, over ? (i + 1) * c : i * c, over ? j * c : (j + 1) * c);
        g.addColorStop(0, over ? '#2a2d31' : '#1b1d20');
        g.addColorStop(0.5, over ? '#40444a' : '#26292d');
        g.addColorStop(1, over ? '#2a2d31' : '#1b1d20');
        ctx.fillStyle = g;
        ctx.fillRect(i * c, j * c, c, c);
      }
    },
    height(ctx, s) {
      const n = 16, c = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const over = ((i + j) >> 1) % 2 === 0;
        const g = ctx.createLinearGradient(i * c, j * c, over ? (i + 1) * c : i * c, over ? j * c : (j + 1) * c);
        g.addColorStop(0, '#606060'); g.addColorStop(0.5, '#d0d0d0'); g.addColorStop(1, '#606060');
        ctx.fillStyle = g;
        ctx.fillRect(i * c, j * c, c, c);
      }
    },
    rough(ctx, s) { ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, s, s); },
    normalStrength: 1.2,
  });
}

/** Polished hangar concrete: aggregate speckle, trowel marks, stains, saw-cut joints. */
export function concrete({ tile = 1024, seed = 5 } = {}) {
  return mapSet(`concrete.${seed}`, tile, {
    albedo(ctx, s) {
      const f = fbm(s, { seed, octaves: 6, base: 3 });
      const img = ctx.createImageData(s, s);
      const r = rng(seed + 1);
      for (let i = 0; i < f.length; i++) {
        const v = 0.42 + f[i] * 0.22 + (r() - 0.5) * 0.05;
        img.data[i * 4] = v * 182; img.data[i * 4 + 1] = v * 184; img.data[i * 4 + 2] = v * 186; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      ctx.globalAlpha = 0.12;
      for (let k = 0; k < 14; k++) {
        const x = r() * s, y = r() * s, rad = s * (0.04 + r() * 0.12);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, '#2a2620'); g.addColorStop(1, 'rgba(42,38,32,0)');
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(30,30,30,0.7)';
      ctx.lineWidth = s / 400;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(s, 1); ctx.moveTo(1, 0); ctx.lineTo(1, s); ctx.stroke();
    },
    height(ctx, s) {
      ctx.drawImage(grime(s, seed + 2, 0.45, 0.55), 0, 0);
      ctx.strokeStyle = '#202020';
      ctx.lineWidth = s / 300;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(s, 1); ctx.moveTo(1, 0); ctx.lineTo(1, s); ctx.stroke();
    },
    rough(ctx, s) {
      const f = fbm(s, { seed: seed + 7, octaves: 5, base: 2 });
      ctx.drawImage(fieldToCanvas(f, s, (v) => 0.22 + v * 0.5), 0, 0);
    },
    normalStrength: 1.0,
  });
}

/**
 * Heat-tint ramp for nozzles and hot-section metal (v = 0 cool end → 1 hot end):
 * bare steel → straw → bronze → purple → blue → dark oxide.
 */
export function heatTintRamp(key = 'default') {
  return once(`heat.${key}`, () => {
    const c = canvas(8, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    [[0, '#8f9398'], [0.25, '#b9a370'], [0.42, '#9c6b3a'], [0.58, '#6d4466'], [0.72, '#3e4f86'], [0.86, '#3a3d4a'], [1, '#2a2622']]
      .forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    const t = tex(c, { srgb: true });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Regeneratively cooled nozzle: fine axial tube pattern (u around → v along). */
export function tubeWall({ tubes = 160, tile = 512 } = {}) {
  return mapSet(`tubes.${tubes}`, tile, {
    height(ctx, s) {
      for (let i = 0; i < tubes; i++) {
        const x = (i / tubes) * s, w = s / tubes;
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#303030'); g.addColorStop(0.5, '#e0e0e0'); g.addColorStop(1, '#303030');
        ctx.fillStyle = g; ctx.fillRect(x, 0, w, s);
      }
    },
    rough(ctx, s) { ctx.drawImage(grime(s, 41, 0.28, 0.5), 0, 0); },
    normalStrength: 1.6,
  });
}

/** Perforated acoustic liner (inlet / bypass duct). */
export function perforated({ tile = 256, pitch = 10 } = {}) {
  return mapSet(`perf.${pitch}`, tile, {
    height(ctx, s) {
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#202020';
      for (let y = pitch / 2; y < s; y += pitch) for (let x = (y / pitch) % 2 ? pitch : pitch / 2; x < s; x += pitch) {
        ctx.beginPath(); ctx.arc(x, y, pitch * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    },
    rough(ctx, s) { ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, s, s); },
    normalStrength: 1.5,
  });
}

/** Painted floor markings: safety-yellow lines, a turntable keep-out circle and hatching. */
/** geometric: false leaves out the lines, ring and hatching (drawn analytically by the hangar floor
 *  shader so they stay sharp at any distance) and keeps the stencil text and tie-down points. */
export function floorMarkings(size = 2048, worldSize = 80, { geometric = true } = {}) {
  return once(`floor.${size}.${geometric}`, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const m = size / worldSize;           // px per metre
    const cx = size / 2;
    ctx.strokeStyle = 'rgba(232,184,30,0.92)';
    ctx.lineWidth = 0.12 * m;
    if (geometric) for (const off of [-13, 13]) {
      ctx.beginPath(); ctx.moveTo(0, cx + off * m); ctx.lineTo(size, cx + off * m); ctx.stroke();
    }
    if (geometric) {
    ctx.beginPath(); ctx.arc(cx, cx, 10.2 * m, 0, Math.PI * 2); ctx.stroke();
    // hatched keep-out band
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cx, 10.2 * m, 0, Math.PI * 2); ctx.arc(cx, cx, 9.6 * m, 0, Math.PI * 2, true); ctx.clip();
    ctx.lineWidth = 0.18 * m;
    for (let x = -size; x < size * 2; x += 0.7 * m) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size, size); ctx.stroke(); }
    ctx.restore();
    }
    // tie-down points
    ctx.fillStyle = 'rgba(40,40,40,0.9)';
    for (let x = -36; x <= 36; x += 6) for (let y = -36; y <= 36; y += 6) {
      if (Math.hypot(x, y) < 11) continue;
      ctx.beginPath(); ctx.arc(cx + x * m, cx + y * m, 0.09 * m, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(232,184,30,0.85)';
    ctx.font = `700 ${0.9 * m}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('BAY 07 · KEEP CLEAR', cx, cx + 12 * m);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  });
}

// ------------------------------------------------------------------------------- close-up detail
// A painted map is as sharp as its texels: once one texel covers several pixels (a 1 m close-up on a 4K
// screen), seams and fasteners in a skin's normal map turn into soft blobs and the paint between them into a
// featureless gradient. Two things are added for that range only, both in the shader of any built-in lit
// material whose normal map came from this library (found by the map's image, so clones keep it):
//   1. seams and fastener heads redrawn from a distance field painted with the map (edges one pixel wide at
//      any magnification), replacing the blurred normal map as it is magnified;
//   2. a tiling micro-detail layer (paint orange-peel, foil micro-crinkle; 1024² over MICRO_TILE metres):
//      fine normal, roughness and tone variation between the seams.
// Each is weighted by magnification (the seams: 0 while a texel of the painted map is a pixel or smaller; the
// micro layer: 0 beyond its third mip level), so a view in which the painted maps are already sharp, any
// whole-vehicle framing included, is drawn exactly as before. Built on the Ultra / 4K presets only;
// FX.crisp = false (?crisp=0) leaves every material and shader untouched.
const MICRO_TILE = 0.25;              // metres covered by one repeat of a micro-detail texture
const skinDetail = new WeakMap();     // normalMap.source → { field, width, height, micro }
const dataTex = (data, w, h, format) => {
  const t = new THREE.DataTexture(data, w, h, format, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

/** Register the close-up detail of a map set: detail = { micro, cut?, raised? } (grey levels of full cut / raised relief). */
function closeUpDetail(normalMap, hgt, detail) {
  if (!FINE()) return;
  let field = null;
  const W = hgt.width, H = hgt.height;
  if (detail.cut || detail.raised) {
    // the height canvas is mid-grey with seams cut darker and fastener heads raised lighter: one field each
    const px = hgt.getContext('2d').getImageData(0, 0, W, H).data, N = W * H;
    const cut = new Uint8Array(N), up = new Uint8Array(N);
    for (let i = 0, k = 0; i < N; i++, k += 4) { const v = px[k]; if (v < 128) cut[i] = 128 - v; else up[i] = v - 128; }
    const a = outlineField(cut, W, H, detail.cut || 255), b = outlineField(up, W, H, detail.raised || 255);
    const rg = new Uint8Array(N * 2);
    for (let i = 0; i < N; i++) { rg[i * 2] = a[i]; rg[i * 2 + 1] = b[i]; }
    field = dataTex(rg, W, H, THREE.RGFormat);
    field.minFilter = THREE.LinearFilter;
  }
  skinDetail.set(normalMap.source, { field, width: W, height: H, micro: detail.micro });
  microDetail(detail.micro);          // painted now, on the boot screen, not at the first frame that needs it
  installDetailShader();
}

/**
 * Micro-detail texture of a material family (RG: tangent-space normal slope, ±1 → 0..1; B: roughness
 * variation; A: tone variation, both centred on 0.5). Only fine features (a few texels to a few dozen), so it
 * tiles without a visible pattern and its mip chain fades to flat.
 */
const microDetail = (kind) => once(`micro.${kind}`, () => {
  const N = 1024, out = new Uint8Array(N * N * 4);
  let hgt, slope;
  if (kind === 'foil') {
    // creased film: ridged noise, sharp folds a few millimetres to a centimetre apart
    hgt = fbm(N, { seed: 97, octaves: 4, base: 20, gain: 0.55 });
    for (let i = 0; i < hgt.length; i++) hgt[i] = Math.abs(hgt[i] - 0.5) * 2;
    slope = 26;
  } else {
    // sprayed paint: a faint orange-peel ripple, 0.5 to 2 mm
    hgt = fbm(N, { seed: 91, octaves: 3, base: 128, gain: 0.7 });
    slope = 2.6;
  }
  // (the roughness and tone variation is the same fine noise for every family: made once)
  const [var1, var2] = once('micro.var', () => [fbm(N, { seed: 93, octaves: 2, base: 64, gain: 0.6 }), fbm(N, { seed: 95, octaves: 2, base: 160, gain: 0.5 })]);
  const byte = (v) => (v < 0 ? 0 : v > 1 ? 255 : v * 255 + 0.5) | 0;
  for (let y = 0; y < N; y++) {
    const ya = ((y + N - 1) % N) * N, yb = ((y + 1) % N) * N, o = (N - 1 - y) * N * 4;      // bottom row first
    for (let x = 0; x < N; x++) {
      const dx = hgt[y * N + (x + 1) % N] - hgt[y * N + (x + N - 1) % N], dy = hgt[yb + x] - hgt[ya + x];
      const k = o + x * 4;
      out[k] = byte(0.5 - dx * slope);
      out[k + 1] = byte(0.5 + dy * slope);
      out[k + 2] = byte(0.5 + (var1[y * N + x] - 0.5) * 2.4);
      out[k + 3] = byte(0.5 + (var2[y * N + x] - 0.5) * 2.4);
    }
  }
  const t = dataTex(out, N, N, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  return t;
});

// strengths per family: x seam slope, y fastener-edge slope (both scaled by the material's normalScale),
// z micro normal slope, w micro roughness swing; tone: micro albedo swing
const MICRO = {
  paint: { q: [1.1, 1.0, 0.1, 0.12], tone: 0.03 },       // micro normal: rms slope 0.035 (matte paint, not a textured coating)
  foil: { q: [1.1, 1.0, 0.5, 0.3], tone: 0.06 },
};

const DETAIL_PARS = /* glsl */`
uniform sampler2D crispMicro;      // RG micro normal slope, B roughness, A tone
uniform vec4 crispP;               // xy: painted map size in texels, zw: micro tiles per unit of the map's UV
uniform vec4 crispQ;               // seam slope, fastener slope, micro normal slope, micro roughness swing
uniform float crispTone;           // micro albedo swing
#ifdef CRISP_FIELD
uniform sampler2D crispField;      // R: signed distance to seam grooves, G: to fastener heads (0.5 = edge, +-4 texels)
#endif
float crispW;                      // seams: 0 while the painted map is sharp enough (texel <= pixel) ... 1 magnified
vec2 crispN;                       // tangent-space normal slope to add (seams and fasteners, then micro)
float crispKeep;                   // share of the painted normal map kept
float crispRough;
float crispAlbedo;
`;
// before the albedo map: weights and the detail terms for this fragment (all texture reads unconditional)
const DETAIL_BEGIN = /* glsl */`
	{
		vec2 crispT = vNormalMapUv * crispP.xy;
		float crispTpp = max( max( length( dFdx( crispT ) ), length( dFdy( crispT ) ) ), 1e-4 );   // map texels per screen pixel
		crispW = 1.0 - smoothstep( 0.5, 1.0, crispTpp );
		// micro layer: in while its own texels are near a pixel or larger, gone by its third mip level
		vec2 crispU = vNormalMapUv * crispP.zw;
		vec2 crispUx = dFdx( crispU ), crispUy = dFdy( crispU );
		float crispWm = 1.0 - smoothstep( 1.0, 4.0, max( length( crispUx ), length( crispUy ) ) * 1024.0 );
		// ... and only where the surface's UVs are near isotropic (a stretched mapping would smear the grain into
		// streaks): lengths of the surface gradients of u and v, from the screen derivatives of position and UV
		vec3 crispPx = dFdx( vViewPosition ), crispPy = dFdy( vViewPosition );
		float crispE1 = dot( crispPx, crispPx ), crispE2 = dot( crispPy, crispPy ), crispE3 = dot( crispPx, crispPy );
		vec2 crispG = ( crispE2 * crispUx * crispUx - 2.0 * crispE3 * crispUx * crispUy + crispE1 * crispUy * crispUy ) / max( crispE1 * crispE2 - crispE3 * crispE3, 1e-24 );
		crispWm *= smoothstep( 0.4, 0.75, sqrt( max( min( crispG.x, crispG.y ), 0.0 ) / max( max( crispG.x, crispG.y ), 1e-24 ) ) );
		vec4 crispM = texture2D( crispMicro, crispU );
		crispN = ( crispM.rg * 2.0 - 1.0 ) * crispQ.z * crispWm;
		crispRough = 1.0 + ( crispM.b - 0.5 ) * crispQ.w * crispWm;
		crispAlbedo = 1.0 + ( crispM.a - 0.5 ) * crispTone * crispWm;
		crispKeep = 1.0;
		#ifdef CRISP_FIELD
			vec2 crispE = 0.5 / crispP.xy;
			vec2 crispF = ( texture2D( crispField, vNormalMapUv ).rg - 0.5 ) * 8.0;            // distance in texels, inside > 0
			vec2 crispFx = ( texture2D( crispField, vNormalMapUv + vec2( crispE.x, 0.0 ) ).rg - texture2D( crispField, vNormalMapUv - vec2( crispE.x, 0.0 ) ).rg ) * 8.0;
			vec2 crispFy = ( texture2D( crispField, vNormalMapUv + vec2( 0.0, crispE.y ) ).rg - texture2D( crispField, vNormalMapUv - vec2( 0.0, crispE.y ) ).rg ) * 8.0;
			// seam: a groove over the painted line's width, its walls sloping in along the field's gradient
			float crispIn = clamp( crispF.r / crispTpp + 0.5, 0.0, 1.0 );
			// fastener: a flat head, its rim a narrow sloped band at the outline
			float crispRim = clamp( ( crispF.g + 0.45 ) / crispTpp + 0.5, 0.0, 1.0 ) * ( 1.0 - clamp( ( crispF.g - 0.45 ) / crispTpp + 0.5, 0.0, 1.0 ) );
			vec2 crispS = crispQ.x * crispIn * vec2( crispFx.r, crispFy.r ) - crispQ.y * crispRim * vec2( crispFx.g, crispFy.g );
			#ifdef USE_NORMALMAP_TANGENTSPACE
				crispS *= normalScale;
			#endif
			crispN += crispS * crispW;
			crispKeep = 1.0 - 0.7 * crispW;              // a third of the painted (soft) relief stays, as the dishing round the sharp line
			crispAlbedo *= 1.0 - crispW * ( 0.26 * crispIn + 0.12 * crispRim );                   // shade in the gap and round the head
		#endif
	}
`;

/** True when the close-up extras are being built (crisp switch on, Ultra / 4K detail). */
export const closeUpDetailOn = () => FINE();
const detailOf = (m) => (m.normalMap ? skinDetail.get(m.normalMap.source) : undefined);
/** Program-cache key of a material's close-up detail ('' when it has none). */
export const closeUpDetailKey = (material) => { const d = detailOf(material); return d ? (d.field ? 'crisp-skin-field' : 'crisp-skin') : ''; };

/**
 * Add the close-up detail code to a lit built-in material's shader (from its onBeforeCompile). Done
 * automatically for materials without a hook of their own; one with its own hook calls this first and
 * includes closeUpDetailKey in its customProgramCacheKey. Returns false when the material has no detail.
 */
export function applyCloseUpDetail(material, shader) {
  const d = detailOf(material);
  if (!d) return false;
  const maps = THREE.ShaderChunk.normal_fragment_maps, scale = /mapN\.xy\s*\*=\s*normalScale\s*;/;
  if (!scale.test(maps)) { console.warn('AEROFORGE surface: ShaderChunk.normal_fragment_maps has changed; close-up detail not applied'); return false; }
  const fam = MICRO[d.micro] || MICRO.paint, rep = material.normalMap.repeat, m = material.userData.microTiles;
  // micro tiles per unit of the map's UV: the map's UVs are metric unless the material says otherwise (userData.microTiles)
  const mx = m ? m[0] : 1 / (rep.x * MICRO_TILE), my = m ? m[1] : 1 / (rep.y * MICRO_TILE);
  shader.uniforms.crispMicro = { value: microDetail(d.micro) };
  shader.uniforms.crispP = { value: new THREE.Vector4(d.width, d.height, mx, my) };
  shader.uniforms.crispQ = { value: new THREE.Vector4(...fam.q) };
  shader.uniforms.crispTone = { value: fam.tone };
  if (d.field) shader.uniforms.crispField = { value: d.field };
  shader.fragmentShader = (d.field ? '#define CRISP_FIELD\n' : '') + shader.fragmentShader
    .replace('#include <normalmap_pars_fragment>', '#include <normalmap_pars_fragment>\n' + DETAIL_PARS)
    .replace('#include <map_fragment>', DETAIL_BEGIN + '\n#include <map_fragment>\n\tdiffuseColor.rgb *= crispAlbedo;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = clamp( roughnessFactor * crispRough, 0.0, 1.0 );')
    .replace('#include <normal_fragment_maps>', maps.replace(scale, 'mapN.xy = mapN.xy * normalScale * crispKeep + crispN;'));
  return true;
}

let detailShader = false;
/** Hook the built-in lit materials once: those whose normal map carries close-up detail get the extra shader code. */
function installDetailShader() {
  if (detailShader) return;
  detailShader = true;
  const proto = THREE.MeshStandardMaterial.prototype;      // MeshPhysicalMaterial inherits
  const own = (m) => Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile');
  const stock = proto.customProgramCacheKey;
  // (a material with a hook of its own keeps three's behaviour: its key is that hook's source)
  proto.customProgramCacheKey = function () { return own(this) ? stock.call(this) : closeUpDetailKey(this); };
  proto.onBeforeCompile = function (shader) { applyCloseUpDetail(this, shader); };
}

// ------------------------------------------------------------------------------- decals
const SDF_SPREAD = 4;                 // texels either side of the edge covered by a decal's distance field
const decalFields = new WeakMap();    // texture.source → { sdf, width, height, ink }

/** The distance field painted with a decal texture (null for opaque tiles): { sdf, width, height, ink }. */
export const decalSdf = (texture) => (texture && decalFields.get(texture.source)) || null;

/**
 * Signed distance (in texels, clamped to ±SDF_SPREAD) from each texel centre to the outline of the ink in a
 * coverage channel `al` (one byte per texel, top row first; `ink` = the value of solid ink). The outline is recovered from the canvas's antialiased
 * coverage at sub-texel accuracy: a partly covered texel fixes the edge's distance from its centre along the
 * coverage gradient (Gustavson, "Anti-aliased Euclidean distance transform", 2011), and that short piece of
 * edge is what nearby texels measure their distance to. Returns bytes, 128 = on the edge, bottom row first
 * (flip = false: top row first).
 */
export function outlineField(al, W, H, ink, flip = true) {
  const S = SDF_SPREAD, S2 = S * S, d2 = new Float32Array(W * H).fill(S2);
  const seg = (x0, y0, x1, y1) => {
    const xa = Math.max(0, Math.ceil(Math.min(x0, x1) - S)), xb = Math.min(W - 1, Math.floor(Math.max(x0, x1) + S));
    const ya = Math.max(0, Math.ceil(Math.min(y0, y1) - S)), yb = Math.min(H - 1, Math.floor(Math.max(y0, y1) + S));
    const dx = x1 - x0, dy = y1 - y0, il2 = 1 / (dx * dx + dy * dy);
    for (let y = ya; y <= yb; y++) for (let x = xa, i = y * W + xa; x <= xb; x++, i++) {
      let t = ((x - x0) * dx + (y - y0) * dy) * il2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + t * dx - x, ey = y0 + t * dy - y, q = ex * ex + ey * ey;
      if (q < d2[i]) d2[i] = q;
    }
  };
  const cov = (x, y) => { const a = al[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)]; return a >= ink ? 1 : a / ink; };
  const HALF = 0.56;       // half-length of each texel's piece of edge: neighbouring pieces overlap a little
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) {
    const a = al[i];
    if (a > 0 && a < ink) {
      // partly covered: the edge passes through this texel, at right angles to the coverage gradient
      let gx = cov(x + 1, y - 1) + 2 * cov(x + 1, y) + cov(x + 1, y + 1) - cov(x - 1, y - 1) - 2 * cov(x - 1, y) - cov(x - 1, y + 1);
      let gy = cov(x - 1, y + 1) + 2 * cov(x, y + 1) + cov(x + 1, y + 1) - cov(x - 1, y - 1) - 2 * cov(x, y - 1) - cov(x + 1, y - 1);
      const gl = Math.hypot(gx, gy);
      if (gl < 1e-6) continue;
      gx /= gl; gy /= gl;
      const c = a / ink, ax = Math.abs(gx), ay = Math.abs(gy), hi = ax > ay ? ax : ay, lo = ax > ay ? ay : ax;
      const a1 = 0.5 * lo / hi;
      // distance from the texel centre to the edge for this coverage (positive: the centre is outside the ink)
      const df = lo < 1e-4 ? 0.5 - c : c < a1 ? 0.5 * (hi + lo) - Math.sqrt(2 * hi * lo * c) : c < 1 - a1 ? (0.5 - c) * hi : -0.5 * (hi + lo) + Math.sqrt(2 * hi * lo * (1 - c));
      const fx = x + gx * df, fy = y + gy * df;
      seg(fx + gy * HALF, fy - gx * HALF, fx - gy * HALF, fy + gx * HALF);
      continue;
    }
    // a clean step between two texels (a shape drawn on the texel grid): the edge is their shared border
    const on = a > 0;
    if (x + 1 < W) { const b = al[i + 1]; if (on ? b === 0 : b >= ink) seg(x + 0.5, y - 0.5, x + 0.5, y + 0.5); }
    if (y + 1 < H) { const b = al[i + W]; if (on ? b === 0 : b >= ink) seg(x - 0.5, y + 0.5, x + 0.5, y + 0.5); }
  }
  const out = new Uint8Array(W * H), half = ink / 2, k = 127.5 / S;
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W, o = (flip ? H - 1 - y : y) * W; x < W; x++, i++, o++) {
    const q = d2[i], inside = al[i] > half;
    out[o] = q >= S2 ? (inside ? 255 : 0) : Math.round(127.5 + (inside ? k : -k) * Math.sqrt(q));
  }
  return out;
}

/**
 * Straight-alpha decal pixels with the ink's colour carried into every transparent texel, so bilinear
 * filtering and the mip chain blend ink with ink instead of with transparent black: no dark fringe round
 * light lettering. One ink: its colour everywhere. Several inks: each clear texel takes the colour of the
 * nearest inked one. Returns RGBA bytes, bottom row first.
 */
function bleedInk(px, W, H, half) {
  const N = W * H, out = new Uint8Array(N * 4);
  let r = 0, g = 0, b = 0, n = 0, r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
  for (let i = 0, k = 0; i < N; i++, k += 4) {
    if (px[k + 3] <= half) continue;
    const R = px[k], G = px[k + 1], B = px[k + 2];
    r += R; g += G; b += B; n++;
    if (R < r0) r0 = R; if (R > r1) r1 = R; if (G < g0) g0 = G; if (G > g1) g1 = G; if (B < b0) b0 = B; if (B > b1) b1 = B;
  }
  let src = null;
  if (r1 - r0 > 6 || g1 - g0 > 6 || b1 - b0 > 6) {
    // several inks: chamfer distance sweeps, carrying the index of the nearest inked texel
    const dist = new Float32Array(N);
    src = new Int32Array(N);
    for (let i = 0; i < N; i++) { const ink = px[i * 4 + 3] > half; dist[i] = ink ? 0 : 1e9; src[i] = ink ? i : -1; }
    const pass = (y0, y1, dy, x0, x1, dx) => {
      for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
        const i = y * W + x;
        if (dist[i] === 0) continue;
        const yy = y - dy, xx = x - dx, rowOk = yy >= 0 && yy < H;
        let best = dist[i], from = src[i];
        if (xx >= 0 && xx < W && dist[i - dx] + 1 < best) { best = dist[i - dx] + 1; from = src[i - dx]; }
        if (rowOk) {
          const j = yy * W + x;
          if (dist[j] + 1 < best) { best = dist[j] + 1; from = src[j]; }
          if (xx >= 0 && xx < W && dist[j - dx] + 1.4142 < best) { best = dist[j - dx] + 1.4142; from = src[j - dx]; }
          if (x + dx >= 0 && x + dx < W && dist[j + dx] + 1.4142 < best) { best = dist[j + dx] + 1.4142; from = src[j + dx]; }
        }
        dist[i] = best; src[i] = from;
      }
    };
    pass(0, H, 1, 0, W, 1);
    pass(H - 1, -1, -1, W - 1, -1, -1);
  } else if (n) { r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n); }
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W, o = (H - 1 - y) * W * 4; x < W; x++, i++, o += 4) {
    const a = px[i * 4 + 3];
    if (src) { const k = (src[i] < 0 ? i : src[i]) * 4; out[o] = px[k]; out[o + 1] = px[k + 1]; out[o + 2] = px[k + 2]; }
    else if (a > half) { out[o] = px[i * 4]; out[o + 1] = px[i * 4 + 1]; out[o + 2] = px[i * 4 + 2]; }
    else { out[o] = r; out[o + 1] = g; out[o + 2] = b; }
    out[o + 3] = a;
  }
  return out;
}

/**
 * Text / insignia decal on a transparent canvas (an opaque drawing is returned as a plain tile).
 * A transparent decal comes back with its ink colour bled into the clear texels and, kept beside it
 * (decalSdf), a distance field of its outline: decal materials use the field to draw a sharp antialiased
 * edge when the texture is magnified (engine/decals.js, crispDecal).
 */
export function decalTexture(key, w, h, draw) {
  return once(`decal.${key}`, () => {
    const W = w * DETAIL, H = h * DETAIL;
    const c = canvas(W, H);
    const ctx = c.getContext('2d', CPU);
    ctx.scale(DETAIL, DETAIL);
    draw(ctx, w, h);
    const px = ctx.getImageData(0, 0, W, H).data;
    const hist = new Uint32Array(256), al = new Uint8Array(W * H);
    for (let i = 0, k = 3; i < al.length; i++, k += 4) hist[al[i] = px[k]]++;
    if (hist[255] === W * H || hist[0] === W * H) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 16;
      return t;
    }
    // the ink's own alpha: the commonest value among the well-covered texels (edges and overlaps are rarer)
    let top = 255;
    while (!hist[top]) top--;
    let ink = top;
    for (let a = top; a > top / 2; a--) if (hist[a] > hist[ink]) ink = a;
    const t = new THREE.DataTexture(bleedInk(px, W, H, ink / 2), W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 16;
    t.needsUpdate = true;
    if (FINE()) {
      const sdf = new THREE.DataTexture(outlineField(al, W, H, ink), W, H, THREE.RedFormat, THREE.UnsignedByteType);
      sdf.magFilter = sdf.minFilter = THREE.LinearFilter;
      sdf.needsUpdate = true;
      decalFields.set(t.source, { sdf, width: W, height: H, ink: ink / 255 });
    }
    return t;
  });
}
