// Procedural surface library: tileable fBm noise, height-to-normal conversion and PBR map sets
// (albedo / roughness / normal) for aircraft skins, rocket tankage, MLI, carbon, concrete and
// heat-tinted metal. Everything is painted on canvases at load time — no image downloads.

import * as THREE from 'three';
import { rng } from './materials.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
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

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Write a scalar field into a canvas as grey (0..1 → 0..255), optionally mapped through fn. */
function fieldToCanvas(field, size, fn = (v) => v) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
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
  const H = (x, y) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
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

/** Build a { map, roughnessMap, normalMap } set from albedo/height/roughness painters. */
function mapSet(key, size, { albedo, height, rough, normalStrength = 2, repeat = [1, 1] }) {
  return once(key, () => {
    const a = canvas(size), hgt = canvas(size), rg = canvas(size);
    albedo?.(a.getContext('2d'), size);
    height(hgt.getContext('2d'), size);
    rough(rg.getContext('2d'), size);
    const set = {
      map: albedo ? tex(a, { srgb: true, repeat }) : null,
      roughnessMap: tex(rg, { repeat }),
      normalMap: tex(heightToNormal(hgt, normalStrength), { repeat }),
    };
    return set;
  });
}

// ------------------------------------------------------------------------------- painters
const grime = (size, seed, lo, hi) => fieldToCanvas(fbm(size, { seed, octaves: 6, base: 3 }), size, (v) => lo + (hi - lo) * v);

/**
 * Aircraft skin tile (2 m × 2 m at repeat 1): access-panel seams with sawtooth edges,
 * fastener rows, slight paint mottling. Height: seams cut in (dark), fasteners raised.
 */
export function aircraftSkin({ seed = 7, tile = 512, sawtooth = true, rivets = true } = {}) {
  return mapSet(`skin.${seed}.${sawtooth}.${rivets}`, tile, {
    albedo(ctx, s) {
      ctx.drawImage(grime(s, seed, 0.86, 1.0), 0, 0);
      const r = rng(seed + 3);
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = r() > 0.5 ? '#000' : '#fff';
        ctx.fillRect(r() * s, r() * s, 30 + r() * 120, 20 + r() * 90);
      }
      ctx.globalAlpha = 1;
    },
    height(ctx, s) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      const r = rng(seed);
      ctx.strokeStyle = '#2a2a2a';
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
          ctx.fillStyle = '#b4b4b4';
          for (let t = 0; t <= 1.0001; t += 0.125) {
            for (const [px, py] of [[x + t * w, y - s * 0.008], [x + t * w, y + h + s * 0.008], [x - s * 0.008, y + t * h], [x + w + s * 0.008, y + t * h]]) {
              ctx.beginPath(); ctx.arc(px, py, s * 0.0028, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
      if (rivets) {
        ctx.fillStyle = '#a8a8a8';
        for (let j = 0; j <= rows; j++) {
          const y = (j / rows) * s;
          for (let x = 0; x < s; x += s / 64) { ctx.beginPath(); ctx.arc(x, y + s * 0.012, s * 0.0024, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    },
    rough(ctx, s) {
      ctx.drawImage(grime(s, seed + 9, 0.48, 0.72), 0, 0);
    },
    normalStrength: 2.6,
  });
}

/** Rocket tank skin: circumferential friction-stir welds, faint isogrid ribs, satin paint. */
export function tankSkin({ seed = 21, tile = 512 } = {}) {
  return mapSet(`tank.${seed}`, tile, {
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
    height(ctx, s) {
      const f = fbm(s, { seed, octaves: 6, base: 6, gain: 0.62 });
      ctx.drawImage(fieldToCanvas(f, s, (v) => Math.abs(v - 0.5) * 2.2), 0, 0);
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
export function floorMarkings(size = 2048, worldSize = 80) {
  return once(`floor.${size}`, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const m = size / worldSize;           // px per metre
    const cx = size / 2;
    ctx.strokeStyle = 'rgba(232,184,30,0.92)';
    ctx.lineWidth = 0.12 * m;
    for (const off of [-13, 13]) {
      ctx.beginPath(); ctx.moveTo(0, cx + off * m); ctx.lineTo(size, cx + off * m); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cx, 10.2 * m, 0, Math.PI * 2); ctx.stroke();
    // hatched keep-out band
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cx, 10.2 * m, 0, Math.PI * 2); ctx.arc(cx, cx, 9.6 * m, 0, Math.PI * 2, true); ctx.clip();
    ctx.lineWidth = 0.18 * m;
    for (let x = -size; x < size * 2; x += 0.7 * m) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size, size); ctx.stroke(); }
    ctx.restore();
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
    t.anisotropy = 8;
    return t;
  });
}

/** Text / insignia decal on a transparent canvas. */
export function decalTexture(key, w, h, draw) {
  return once(`decal.${key}`, () => {
    const c = canvas(w, h);
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}
