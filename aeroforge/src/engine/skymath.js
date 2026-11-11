// The open-sky look's pure maths, kept free of three.js so the tests can load it: the scattering
// model the sky shader and the JS mirror share, the cloud field's tiling constants and quality
// tiers, the tileable noise generators, and the contrail threshold.

// ------------------------------------------------------------------------------- tiling
/** The deck scroll wraps here (m); every tile below divides it, so the wrap is invisible. */
export const WRAP = 90000;
export const TILES = { region: 90000, land: 45000, tower: 30000, cells: 15000, mid: 3000, fine: 600, detail: 120, cirrusMask: 90000, cirrus: 45000, cirrusFibre: 3000, cirrusFine: 600 };
/** The two drift (noise-phase) vectors wrap on the tile they offset (m). */
export const DRIFT_WRAP = { mid: TILES.mid, cells: TILES.cells };
export const NOISE_SIZE = 512;

/** Quality tiers for the deck: relief = ray-march steps (0 = flat), shadow = self-shadow steps,
 *  detail = the 12 m octave, cirrus / groundShadow / flare = 0 | 1. */
export const SKY_TIERS = {
  '4k':        { relief: 6, shadow: 4, detail: 1, cirrus: 1, groundShadow: 1, flare: 1 },
  ultra:       { relief: 6, shadow: 4, detail: 1, cirrus: 1, groundShadow: 1, flare: 1 },
  high:        { relief: 4, shadow: 3, detail: 1, cirrus: 1, groundShadow: 1, flare: 1 },
  balanced:    { relief: 0, shadow: 2, detail: 0, cirrus: 1, groundShadow: 1, flare: 1 },
  performance: { relief: 0, shadow: 0, detail: 0, cirrus: 0, groundShadow: 0, flare: 0 },
};

// ------------------------------------------------------------------------------- atmosphere
// Single scattering (Rayleigh + Mie) on the spherical Earth with sea-level coefficients; the
// sun's optical depth from the Kasten-Young airmass; a soft clip on the single-scattered light
// and a pale multiple-scattering term stand in for the higher orders, so the horizon band comes
// out white-blue rather than saturated blue. SUN_E scales the sun's irradiance into the scene's
// linear units (the zenith at sea level lands near the photographic plate's).
export const ATM = {
  R: 6371000, H: 80000, betaR: [5.8e-6, 13.5e-6, 33.1e-6], HR: 8000, betaM: 4.0e-6, HM: 1500, g: 0.8,
  bg: 0.02,                        // background (stratospheric) aerosol, as a fraction of sea-level Mie density
  E: 19, clip: 0.4, ms: [0.62, 0.52, 0.56],
  kms: 1.0,                        // grey extinction added per unit of green Rayleigh depth: light scattered out of the line of sight by the higher orders and the aerosol the model leaves out
};

export function airmass(sinE) {
  const e = Math.asin(Math.min(Math.max(sinE, -1), 1)) * 180 / Math.PI;
  return 1 / Math.max(sinE + 0.15 * Math.pow(Math.max(e + 3.885, 0.1), -1.253), 0.02);
}

/**
 * In-scattered sky light (linear rgb) along dir (unit, y up) from a camera at camAlt (m) out to
 * tEnd metres (or the top of the atmosphere), and the transmittance over that path: the same
 * model as the shader's inscatter(). sunColor is a THREE.Color or [r, g, b].
 */
export function inscatter(dir, sunDir, camAlt, { sunColor = [1, 1, 1], tEnd = Infinity, n = 10 } = {}) {
  const sc = sunColor.isColor ? [sunColor.r, sunColor.g, sunColor.b] : sunColor;
  const r0 = ATM.R + camAlt, b = r0 * dir.y, c = r0 * r0 - (ATM.R + ATM.H) ** 2;
  const len = Math.min(tEnd, -b + Math.sqrt(Math.max(b * b - c, 0)));
  const cosT = dir.x * sunDir.x + dir.y * sunDir.y + dir.z * sunDir.z;
  const pr = 0.0596831 * (1 + cosT * cosT);
  const g2 = ATM.g * ATM.g;
  const pm = 0.0795775 * (1 - g2) / Math.pow(Math.max(1 + g2 - 2 * ATM.g * cosT, 1e-4), 1.5);
  const xs = airmass(sunDir.y);
  const tau = [0, 0, 0], LR = [0, 0, 0], LM = [0, 0, 0];
  const dt = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * dt;
    const h = Math.max(Math.sqrt(Math.max(r0 * r0 + t * t + 2 * r0 * t * dir.y, 0)) - ATM.R, 0);
    const rhoR = Math.exp(-h / ATM.HR), rhoM = Math.exp(-h / ATM.HM) + ATM.bg * Math.exp(-h / 25000);
    for (let k = 0; k < 3; k++) {
      const ext = ATM.betaR[k] * rhoR + ATM.betaM * 1.1 * rhoM;
      const tauSun = (ATM.betaR[k] * ATM.HR * rhoR + ATM.betaM * 1.1 * ATM.HM * rhoM) * xs;
      tau[k] += ext * dt * 0.5;
      const T = Math.exp(-(tau[k] + tauSun));
      LR[k] += T * ATM.betaR[k] * rhoR * pr * dt;
      LM[k] += T * ATM.betaM * rhoM * pm * dt;
      tau[k] += ext * dt * 0.5;
    }
  }
  const transm = tau.map((v) => Math.exp(-(v + ATM.kms * tau[1])));
  // the Rayleigh light is soft-clipped (the higher orders whiten and dim a deep path); the Mie
  // aureole stays HDR for the bloom; the pale multiple-scattering lift grows with the depth
  const light = LR.map((v, k) => {
    const ss = v * sc[k] * ATM.E;
    return ATM.clip * (1 - Math.exp(-ss / ATM.clip)) + LM[k] * sc[k] * ATM.E + (1 - transm[k]) * ATM.ms[k] * sc[k];
  });
  return { light, transm };
}

/** The sky's radiance in a direction (linear rgb). */
export function skyRadiance(dir, sunDir, camAlt, sunColor = [1, 1, 1], n = 10) {
  return inscatter(dir, sunDir, camAlt, { sunColor, n }).light;
}

// ------------------------------------------------------------------------------- atmosphere, second model
// The volumetric sky's atmosphere (skyvol.js): Rayleigh and Mie single scattering and ozone
// absorption on the spherical Earth with the standard sea-level coefficients (Bruneton & Neyret
// 2008; Hillaire 2020), integrated numerically along the view ray, the sun's optical depth from
// the Kasten-Young airmass, and the higher orders of scattering as an isotropic source in
// proportion to the local scattering (Hillaire's multiple-scattering term, as a constant). Nothing
// is clipped or tinted: the white horizon band, the deep zenith at altitude and the blue veil over
// distance all come out of the integral. E scales the sun into the scene's linear units.
export const ATM2 = {
  R: 6371000, H: 100000,
  betaR: [5.802e-6, 13.558e-6, 33.1e-6], HR: 8000,
  betaMs: 1.4e-5, betaMe: 1.55e-5, HM: 1200, g: 0.8,          // a clean maritime aerosol (optical depth 0.019)
  betaO: [0.65e-6, 1.881e-6, 0.085e-6], ozoneAlt: 25000, ozoneHalf: 15000,
  E: 11,
  ms: [0.022, 0.03, 0.046],        // the higher orders' source per unit of scattering: sky light is blue, so they are too
};

/** In-scattered light (linear rgb) along dir from camAlt (m) out to tEnd metres, and the
 *  transmittance over that path: the same arithmetic as skyvol.js's GLSL inscatter(). */
export function inscatter2(dir, sunDir, camAlt, { sunColor = [1, 1, 1], tEnd = Infinity, n = 12 } = {}) {
  const A = ATM2;
  const sc = sunColor.isColor ? [sunColor.r, sunColor.g, sunColor.b] : sunColor;
  const r0 = A.R + camAlt, b = r0 * dir.y, c = (camAlt - A.H) * (2 * A.R + camAlt + A.H);
  const len = Math.min(tEnd, -b + Math.sqrt(Math.max(b * b - c, 0)));
  const cosT = dir.x * sunDir.x + dir.y * sunDir.y + dir.z * sunDir.z;
  const pr = 0.0596831 * (1 + cosT * cosT);
  const g2 = A.g * A.g;
  const pm = 0.0795775 * (1 - g2) / Math.pow(Math.max(1 + g2 - 2 * A.g * cosT, 1e-4), 1.5);
  const xs = airmass(sunDir.y);
  const tau = [0, 0, 0], L = [0, 0, 0];
  const dt = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * dt;
    const h = Math.max(Math.sqrt(Math.max(r0 * r0 + t * t + 2 * r0 * t * dir.y, 0)) - A.R, 0);
    const rhoR = Math.exp(-h / A.HR), rhoM = Math.exp(-h / A.HM);
    const rhoO = Math.max(0, 1 - Math.abs(h - A.ozoneAlt) / A.ozoneHalf);
    const colO = A.ozoneHalf * Math.min(Math.max((A.ozoneAlt + A.ozoneHalf - h) / (2 * A.ozoneHalf), 0), 1);
    for (let k = 0; k < 3; k++) {
      const ext = A.betaR[k] * rhoR + A.betaMe * rhoM + A.betaO[k] * rhoO;
      const tauSun = (A.betaR[k] * A.HR * rhoR + A.betaMe * A.HM * rhoM + A.betaO[k] * colO) * xs;
      tau[k] += ext * dt * 0.5;
      const scat = A.betaR[k] * rhoR * pr + A.betaMs * rhoM * pm;
      const msr = (A.betaR[k] * rhoR + A.betaMs * rhoM) * A.ms[k];
      L[k] += (Math.exp(-(tau[k] + tauSun)) * scat + Math.exp(-(tau[k] + tauSun * 0.35)) * msr) * dt;
      tau[k] += ext * dt * 0.5;
    }
  }
  return { light: L.map((v, k) => v * A.E * sc[k]), transm: tau.map((v) => Math.exp(-v)) };
}

export function skyRadiance2(dir, sunDir, camAlt, sunColor = [1, 1, 1], n = 12) {
  return inscatter2(dir, sunDir, camAlt, { sunColor, n }).light;
}

// ------------------------------------------------------------------------------- contrails
/**
 * Contrail factor for an aircraft: condensation trails form where the exhaust's water vapour
 * freezes, in the cold air above roughly 8 km (the Schmidt–Appleman threshold at mid-latitudes:
 * −40 °C and below), and need the engine running. 0..1.
 */
export function contrailFactor(altitude, { running = 1 } = {}) {
  const a = Math.min(Math.max((altitude - 7600) / 2000, 0), 1);
  return a * a * (3 - 2 * a) * Math.min(Math.max(running, 0), 1);
}

// ------------------------------------------------------------------------------- noise
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(out) {
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, 1e-6);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / span;
  return out;
}

/** Tileable gradient (Perlin) noise summed over octaves, each octave's lattice shifted by a
 *  random phase so no grid shows through; normalised to 0..1. */
export function tileableFbm(size, { seed = 1, octaves = 7, base = 4, gain = 0.5 } = {}) {
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

/** Tileable cellular (Worley) noise: `cells`² jittered feature points per tile, each turned into
 *  a domed bump (1 at the point, 0 at the cell walls), plus a half-weight layer at twice the
 *  frequency for sub-structure; normalised to 0..1. */
export function tileableWorley(size, { seed = 5, cells = 10 } = {}) {
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
