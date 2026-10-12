// Shared PBR materials and procedurally painted canvas textures.

import * as THREE from 'three';
import { aircraftSkin, mliSurface, carbonWeave, tubeWall, perforated } from './surface.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  return c;
}

function texture(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// deterministic PRNG so textures look identical on every load
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stealth skin: faint panel seams with sawtooth edges and RAM tape patches. */
export const panelTexture = () => once('tex.panel', () => texture(canvas(1024, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const r = rng(7);
  ctx.strokeStyle = 'rgba(40,46,52,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9) + (r() - 0.5) * 30;
    ctx.beginPath();
    for (let y = 0; y <= h; y += 32) {
      const zig = (y / 32) % 2 === 0 ? -9 : 9;
      if (y === 0) ctx.moveTo(x + zig, y); else ctx.lineTo(x + zig, y);
    }
    ctx.stroke();
  }
  for (let j = 0; j < 7; j++) {
    const y = (j + 0.5) * (h / 7);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,78,86,0.10)';
  for (let k = 0; k < 26; k++) ctx.fillRect(r() * w, r() * h, 40 + r() * 160, 18 + r() * 60);
  ctx.fillStyle = 'rgba(30,34,38,0.5)';
  for (let k = 0; k < 140; k++) {
    ctx.beginPath(); ctx.arc(r() * w, r() * h, 1.6, 0, Math.PI * 2); ctx.fill();
  }
}), { repeat: [3, 1] }));

/** Rocket stage paint: white with weld rings, sooting near the base and a vertical wordmark. */
export function rocketBodyTexture(label, { soot = 0.4, band = null } = {}) {
  return once(`tex.rocket.${label}.${soot}.${band}`, () => texture(canvas(512, 2048, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f4f5f6');
    g.addColorStop(1 - soot, '#eceeef');
    g.addColorStop(1, soot > 0 ? '#5d5650' : '#e9ebec');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(label.length * 13);
    // soot streaks
    if (soot > 0) {
      for (let i = 0; i < 90; i++) {
        const x = r() * w;
        const len = h * soot * (0.4 + r() * 0.9);
        const sg = ctx.createLinearGradient(0, h, 0, h - len);
        sg.addColorStop(0, 'rgba(40,34,30,0.55)');
        sg.addColorStop(1, 'rgba(40,34,30,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x, h - len, 2 + r() * 8, len);
      }
    }
    ctx.strokeStyle = 'rgba(120,128,136,0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 150) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    if (band) {
      ctx.fillStyle = '#16181b';
      ctx.fillRect(0, h * band[0], w, h * (band[1] - band[0]));
    }
    // wordmark, reading bottom-to-top, centred on the camera-facing side (u = 0.5)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.62);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#121418';
    ctx.font = '700 112px "Chakra Petch", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
    // amber stripe: tank / interstage marker
    ctx.fillStyle = '#e29a14';
    ctx.fillRect(0, h * 0.06, w, 10);
  })));
}

/** Gold multi-layer insulation: crinkled foil with specular streaks. */
export const mliTexture = () => once('tex.mli', () => texture(canvas(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#c99a3c';
  ctx.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 700; i++) {
    const x = r() * w, y = r() * h;
    const l = 10 + r() * 60;
    const a = r() * Math.PI;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,232,170,${0.15 + r() * 0.35})` : `rgba(90,58,12,${0.15 + r() * 0.3})`;
    ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(80,55,15,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
}), { repeat: [1, 1] }));

/** Solar array substrate: triple-junction GaAs cells with busbars. */
export const solarTexture = () => once('tex.solar', () => texture(canvas(512, 1024, (ctx, w, h) => {
  ctx.fillStyle = '#c9ced4';
  ctx.fillRect(0, 0, w, h);
  const cols = 6, rows = 14, pad = 3;
  const cw = w / cols, ch = h / rows;
  const r = rng(11);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
      const tone = 30 + r() * 14;
      g.addColorStop(0, `rgb(${tone * 0.5},${tone * 0.9},${tone * 2.6})`);
      g.addColorStop(1, `rgb(${tone * 0.3},${tone * 0.6},${tone * 1.9})`);
      ctx.fillStyle = g;
      ctx.fillRect(i * cw + pad, j * ch + pad, cw - pad * 2, ch - pad * 2);
      ctx.fillStyle = 'rgba(210,220,235,0.45)';
      for (let k = 1; k < 5; k++) ctx.fillRect(i * cw + pad, j * ch + (ch * k) / 5, cw - pad * 2, 1);
    }
  }
})));

/** Jet-engine spinner: the classic white spiral that tells ground crew the fan is turning. */
export const spinnerTexture = () => once('tex.spinner', () => texture(canvas(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#1c1f23';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  // in lathe UV space: u around, v along — a spiral is a diagonal band
  ctx.moveTo(0, h); ctx.lineTo(w * 0.22, h); ctx.lineTo(w, h * 0.12); ctx.lineTo(w, 0); ctx.lineTo(w * 0.9, 0);
  ctx.closePath();
  ctx.fill();
}), { repeat: [1, 1] }));

/** Generic radial glow sprite. */
export const glowTexture = () => once('tex.glow', () => {
  const t = new THREE.CanvasTexture(canvas(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  }));
  return t;
});

/** Soft smoke puff sprite for launch exhaust clouds. */
export const smokeTexture = () => once('tex.smoke', () => {
  const t = new THREE.CanvasTexture(canvas(128, 128, (ctx, w) => {
    const r = rng(5);
    for (let i = 0; i < 18; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.4, y = w / 2 + (r() - 0.5) * w * 0.4;
      const rad = w * (0.18 + r() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    }
  }));
  return t;
});

// ---------------------------------------------------------------------------------- materials

const std = (key, params) => once(key, () => new THREE.MeshStandardMaterial(params));
const phys = (key, params) => once(key, () => new THREE.MeshPhysicalMaterial(params));

/** Clone a surface map set with its own tiling (metres per tile for metric UVs). */
function tiled(set, rx, ry = rx) {
  const out = {};
  for (const [k, t] of Object.entries(set)) {
    if (!t) continue;
    const c = t.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    out[k] = c;
  }
  return out;
}

/** Materials that carry procedural surface detail (normal / roughness / albedo variation). */
export const SKIN = {
  stealth: () => once('s.stealth', () => {
    const t = tiled(aircraftSkin({ seed: 7 }), 1 / 2.6);
    return new THREE.MeshStandardMaterial({ color: 0x5c646c, ...t, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 1, metalness: 0.3 });
  }),
  stealthWing: () => once('s.stealthWing', () => {
    const t = tiled(aircraftSkin({ seed: 13 }), 1 / 2.2);
    return new THREE.MeshStandardMaterial({ color: 0x545c64, ...t, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 0.3 });
  }),
  uav: () => once('s.uav', () => {
    const t = tiled(aircraftSkin({ seed: 29, sawtooth: false }), 1 / 2.4);
    return new THREE.MeshStandardMaterial({ color: 0xa3aab1, ...t, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, metalness: 0.08 });
  }),
  uavDark: () => once('s.uavDark', () => {
    const t = tiled(aircraftSkin({ seed: 31, sawtooth: false, rivets: false }), 1 / 2.4);
    return new THREE.MeshStandardMaterial({ color: 0x6a7178, ...t, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, metalness: 0.1 });
  }),
  nacelle: () => once('s.nacelle', () => {
    const t = tiled(aircraftSkin({ seed: 41, sawtooth: false }), 2.5, 1);
    return new THREE.MeshPhysicalMaterial({ color: 0xdfe3e7, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.38, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide });
  }),
  liner: () => once('s.liner', () => {
    const t = tiled(perforated(), 60, 8);
    return new THREE.MeshStandardMaterial({ color: 0x8a9096, normalMap: t.normalMap, roughness: 0.55, metalness: 0.7, side: THREE.DoubleSide });
  }),
  carbon: () => once('s.carbon', () => {
    const t = tiled(carbonWeave(), 6, 6);
    return new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...t, roughness: 1, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  }),
  mli: () => once('s.mli', () => {
    const t = tiled(mliSurface(), 1.6);
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: mliTexture(), normalMap: t.normalMap, roughnessMap: t.roughnessMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1, metalness: 1 });
  }),
  bell: () => once('s.bell', () => {
    const t = tiled(tubeWall({ tubes: 180 }), 1, 1);
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: bellTint(), normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.92, side: THREE.DoubleSide });
  }),
};

/** Regeneratively cooled bell: copper chamber, blued throat, bronze-to-straw skirt (lathe v runs down the nozzle). */
export const bellTint = () => once('tex.bellTint', () => {
  const c = canvas(8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    [[0, '#8a8e93'], [0.06, '#a0623c'], [0.2, '#7a4a35'], [0.3, '#4c3d6e'], [0.38, '#3d5590'], [0.5, '#6b4f63'], [0.66, '#9a6c3e'], [0.84, '#b39a6e'], [1, '#8d8a84']]
      .forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
});

export const M = {
  stealth: () => std('m.stealth', { color: 0x4f575e, roughness: 0.58, metalness: 0.32, map: panelTexture(), flatShading: true }),
  stealthSmooth: () => std('m.stealthSmooth', { color: 0x4f575e, roughness: 0.55, metalness: 0.3, map: panelTexture() }),
  stealthDark: () => std('m.stealthDark', { color: 0x434a51, roughness: 0.6, metalness: 0.35, flatShading: true }),
  canopy: () => phys('m.canopy', {
    color: 0x6e5326, metalness: 0.62, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.9, envMapIntensity: 1.0,
  }),
  intake: () => std('m.intake', { color: 0x0b0c0e, roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide }),
  darkMetal: () => std('m.darkMetal', { color: 0x2c2f33, roughness: 0.42, metalness: 0.85 }),
  gunmetal: () => std('m.gunmetal', { color: 0x464b52, roughness: 0.36, metalness: 0.9 }),
  titanium: () => std('m.titanium', { color: 0xa9b1b8, roughness: 0.28, metalness: 1.0 }),
  inconel: () => std('m.inconel', { color: 0x7b6656, roughness: 0.42, metalness: 0.92 }),
  heatTint: () => std('m.heatTint', { color: 0x5b4f6e, roughness: 0.35, metalness: 0.95 }),
  copper: () => std('m.copper', { color: 0xb5713f, roughness: 0.32, metalness: 1.0 }),
  aluminium: () => std('m.aluminium', { color: 0xc6ccd2, roughness: 0.38, metalness: 0.95 }),
  white: () => std('m.white', { color: 0xf1f3f5, roughness: 0.42, metalness: 0.05 }),
  offWhite: () => std('m.offWhite', { color: 0xd9dde1, roughness: 0.5, metalness: 0.1 }),
  carbon: () => std('m.carbon', { color: 0x1b1d20, roughness: 0.5, metalness: 0.35 }),
  bell: () => std('m.bell', { color: 0x3d3632, roughness: 0.36, metalness: 0.9, side: THREE.DoubleSide }),
  niobium: () => std('m.niobium', { color: 0x2a2626, roughness: 0.3, metalness: 0.95, side: THREE.DoubleSide }),
  rubber: () => std('m.rubber', { color: 0x141414, roughness: 0.92, metalness: 0.0 }),
  glass: () => phys('m.glass', { color: 0x0b1620, roughness: 0.04, metalness: 0.4, clearcoat: 1 }),
  mli: () => std('m.mli', { color: 0xffffff, map: mliTexture(), roughness: 0.34, metalness: 1.0 }),
  osr: () => std('m.osr', { color: 0xc9d2da, roughness: 0.34, metalness: 0.6 }),
  solar: () => std('m.solar', { color: 0xffffff, map: solarTexture(), roughness: 0.22, metalness: 0.45 }),
  gse: () => std('m.gse', { color: 0xd9a71e, roughness: 0.55, metalness: 0.2 }),
  uavGrey: () => std('m.uavGrey', { color: 0x9aa1a8, roughness: 0.55, metalness: 0.15 }),
  uavDark: () => std('m.uavDark', { color: 0x5d636a, roughness: 0.55, metalness: 0.25 }),
  munition: () => std('m.munition', { color: 0x6e7559, roughness: 0.55, metalness: 0.25 }),
  missile: () => std('m.missile', { color: 0xdedfd9, roughness: 0.45, metalness: 0.15 }),
  seeker: () => std('m.seeker', { color: 0x30363c, roughness: 0.25, metalness: 0.6 }),
  spinner: () => std('m.spinner', { color: 0xffffff, map: spinnerTexture(), roughness: 0.3, metalness: 0.6 }),
  section: () => std('m.section', { color: 0xc4532e, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
  pad: () => std('m.pad', { color: 0x31373e, roughness: 0.75, metalness: 0.4 }),
  // emissive
  navRed: () => std('m.navRed', { color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 7 }),
  navGreen: () => std('m.navGreen', { color: 0x002200, emissive: 0x2bff6a, emissiveIntensity: 7 }),
  formation: () => std('m.formation', { color: 0x0c1a10, emissive: 0x7dffa0, emissiveIntensity: 3.6 }),
  strobe: () => std('m.strobe', { color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0 }),
  burner: () => std('m.burner', { color: 0x200800, emissive: 0xff6a1a, emissiveIntensity: 3.5, side: THREE.DoubleSide }),
  turbineGlow: () => std('m.turbineGlow', { color: 0x1a0800, emissive: 0xff4a10, emissiveIntensity: 0.6 }),
  laser: () => std('m.laser', { color: 0x200000, emissive: 0xff2030, emissiveIntensity: 9 }),
};
