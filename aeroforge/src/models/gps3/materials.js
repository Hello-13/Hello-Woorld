// GPS III surface materials: black and silver multi-layer insulation, quartz OSR radiators,
// triple-junction cells, the black antenna panel with black Earth-coverage and grey crosslink
// radomes, and the finishes of avionics boxes. Exterior finishes follow the pre-launch images of
// SV02 and the manufacturer's scale model (Steigenberger et al. 2020, §4 and Fig. 4): silver MLI on
// the Sun-facing +X face and the +Z antenna face, black MLI on −X and most of −Z.

import * as THREE from 'three';
import { M, SKIN } from '../../engine/materials.js';
import { mliSurface, carbonWeave, decalTexture } from '../../engine/surface.js';

const cache = new Map();
const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

/** Clone a texture with its own tiling. */
function tile(t, rx, ry = rx) {
  if (!t) return null;
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.anisotropy = 8;
  c.needsUpdate = true;
  return c;
}

// quartz second-surface mirror tiles (≈ 4 × 4 cm) on the radiator panels
const osrTexture = () => decalTexture('gps3.osr', 512, 512, (ctx, w) => {
  ctx.fillStyle = '#7d858d';
  ctx.fillRect(0, 0, w, w);
  const n = 16, c = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 196 + ((i * 7 + j * 13) % 9) * 4;
    ctx.fillStyle = `rgb(${v},${v + 4},${v + 9})`;
    ctx.fillRect(i * c + 1.5, j * c + 1.5, c - 3, c - 3);
  }
});

// triple-junction cells (≈ 4 × 7 cm): near-black blue with a faint, thin silver grid of
// interconnects and gaps, the panel's cell side (the manufacturer's render shows the cells
// almost black, the grid barely there, under a glossy coverglass sheen)
const cellTexture = () => decalTexture('gps3.cells', 512, 512, (ctx, w) => {
  ctx.fillStyle = '#5a6168';
  ctx.fillRect(0, 0, w, w);
  const cols = 8, rows = 12, cw = w / cols, ch = w / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = ((i * 5 + j * 3) % 7) / 7;
    const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
    g.addColorStop(0, `rgb(${7 + k * 4},${11 + k * 5},${30 + k * 10})`);
    g.addColorStop(1, `rgb(${4 + k * 3},${7 + k * 4},${20 + k * 8})`);
    ctx.fillStyle = g;
    ctx.fillRect(i * cw + 1, j * ch + 1, cw - 2, ch - 2);
    ctx.fillStyle = 'rgba(150,160,175,0.16)';
    for (let k2 = 1; k2 < 6; k2++) ctx.fillRect(i * cw + 1 + ((cw - 2) * k2) / 6, j * ch + 1, 1, ch - 2);
    ctx.fillStyle = 'rgba(170,178,190,0.3)';
    ctx.fillRect(i * cw + 1, j * ch + 1, cw - 2, 1);
  }
});

export const G = {
  /** Multi-layer insulation with a black carbon-loaded Kapton outer layer. */
  blackMLI: (r = 1.2) => once(`blackMLI${r}`, () => {
    const s = mliSurface();   // the engine's default crinkle (shared with SKIN.mli): one procedural surface for all three blankets
    return new THREE.MeshStandardMaterial({
      color: 0x2a2c31, normalMap: tile(s.normalMap, r), roughnessMap: tile(s.roughnessMap, r),
      normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.5, metalness: 0.3,
    });
  }),
  /** Silver multi-layer insulation (aluminised outer layer): the Sun-facing +X face and, in a
   *  radio-transparent version, the +Z antenna face. Crinkled foil is a satin, not a mirror: a
   *  mid-grey base at roughness ≈ 0.5 so the orbit sun (intensity 4.2) lights the face silver-grey
   *  with bright creases where the normal map catches it, instead of clipping the whole face to
   *  white (the shared roughness map of mliSurface runs 0.18–0.42 and would make it a mirror). */
  silverMLI: (r = 1.2) => once(`silverMLI${r}`, () => {
    const s = mliSurface();
    return new THREE.MeshStandardMaterial({
      color: 0x9da2a8, normalMap: tile(s.normalMap, r),
      normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.5, metalness: 0.65,
    });
  }),
  /** Gold (aluminised Kapton, amber side out) wrap of the oxidiser tanks in the scale model. */
  goldMLI: () => SKIN.mli(),
  /** Black paint / black Kapton: the antenna panel and the radiator strip along the −X edge. */
  blackPaint: () => once('blackPaint', () => new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.62, metalness: 0.1 })),
  /** Black tapered Earth-coverage radomes. */
  radomeBlack: () => once('radomeBlack', () => new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.45, metalness: 0.05 })),
  /** Optical solar reflector radiator: quartz mirrors on aluminium honeycomb. */
  osr: (rx, ry) => once(`osr${rx}.${ry}`, () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: tile(osrTexture(), rx, ry), metalness: 0.85, roughness: 0.24,
    clearcoat: 0.6, clearcoatRoughness: 0.18,
  })),
  /** Coverglassed cells: a dark dielectric under a glossy clearcoat, so the panel reads near-black
   *  blue with a sheen and the sun's glint stays a highlight, not a bloom. */
  cells: (rx, ry) => once(`cells${rx}.${ry}`, () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: tile(cellTexture(), rx, ry), roughness: 0.32, metalness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.32, iridescence: 0.15, iridescenceIOR: 1.6,
  })),
  panelBack: () => once('panelBack', () => {
    const cw = carbonWeave();
    return new THREE.MeshPhysicalMaterial({ color: 0x8c9196, map: tile(cw.map, 10), normalMap: tile(cw.normalMap, 10), roughness: 0.55, metalness: 0.3, clearcoat: 0.3 });
  }),
  cfrp: (r = 3) => once(`cfrp${r}`, () => {
    const cw = carbonWeave();
    return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: tile(cw.map, r), normalMap: tile(cw.normalMap, r), roughness: 0.5, metalness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.25, side: THREE.DoubleSide });
  }),
  honeycomb: () => once('honeycomb', () => new THREE.MeshStandardMaterial({ color: 0xa9afb5, roughness: 0.45, metalness: 0.8 })),
  whitePaint: () => once('whitePaint', () => new THREE.MeshStandardMaterial({ color: 0xeef0f1, roughness: 0.55, metalness: 0.02 })),
  radome: () => once('radome', () => new THREE.MeshStandardMaterial({ color: 0xf3f2ec, roughness: 0.42, metalness: 0.0 })),
  /** The UHF crosslink radomes: pale grey fibreglass, a step below the white TT&C radomes so the
   *  black L-band array stays the dominant element of the nadir deck (manufacturer's render). */
  radomeGrey: () => once('radomeGrey', () => new THREE.MeshStandardMaterial({ color: 0xc4c6c2, roughness: 0.5, metalness: 0.0 })),
  helixWire: () => once('helixWire', () => new THREE.MeshStandardMaterial({ color: 0xc98b4a, roughness: 0.3, metalness: 1.0 })),
  alodine: () => once('alodine', () => new THREE.MeshStandardMaterial({ color: 0xc8b47a, roughness: 0.38, metalness: 0.85 })),
  silverBox: () => once('silverBox', () => new THREE.MeshStandardMaterial({ color: 0xb4b9be, roughness: 0.35, metalness: 0.9 })),
  blackBox: () => once('blackBox', () => new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.5, metalness: 0.35 })),
  connector: () => once('connector', () => new THREE.MeshStandardMaterial({ color: 0x5b5f64, roughness: 0.4, metalness: 0.9 })),
  harness: () => once('harness', () => new THREE.MeshStandardMaterial({ color: 0xd8d2bf, roughness: 0.7, metalness: 0.05 })),
  /** Power bundles: heavier gauge, in a darker sleeve so they read apart from the data harness. */
  powerHarness: () => once('powerHarness', () => new THREE.MeshStandardMaterial({ color: 0xa88b5c, roughness: 0.65, metalness: 0.1 })),
  /** Propellant tanks: Orbital ATK composite tanks, titanium liner under a carbon-fibre overwrap
   *  (a satin resin finish rather than a polished metal). */
  tank: () => once('tank', () => {
    const cw = carbonWeave();
    return new THREE.MeshPhysicalMaterial({ color: 0x80858b, normalMap: tile(cw.normalMap, 6), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.5, metalness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  }),
  copv: () => once('copv', () => {
    const cw = carbonWeave();
    return new THREE.MeshPhysicalMaterial({ color: 0x777b80, map: tile(cw.map, 4), roughness: 0.46, metalness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  }),
  /** Satin titanium for fittings and bosses (not mirror-polished). */
  satinTi: () => once('satinTi', () => new THREE.MeshStandardMaterial({ color: 0xa7a39c, roughness: 0.46, metalness: 0.8 })),
  /** Beryllium-copper STEM tape of the deployable monopoles. */
  stem: () => once('stem', () => new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.34, metalness: 0.9 })),
  redTag: () => once('redTag', () => new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.6, metalness: 0.0 })),
  tubing: () => once('tubing', () => new THREE.MeshStandardMaterial({ color: 0xb7bcc1, roughness: 0.3, metalness: 1.0 })),
  nozzle: () => once('nozzle', () => new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide })),
  heater: () => once('heater', () => new THREE.MeshStandardMaterial({ color: 0xb4682a, roughness: 0.5, metalness: 0.3 })),
  lens: () => once('lens', () => new THREE.MeshPhysicalMaterial({ color: 0x15181c, roughness: 0.12, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.1 })),
  prism: () => once('prism', () => new THREE.MeshPhysicalMaterial({ color: 0xcfe3ef, roughness: 0.1, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.1 })),
  aluminium: () => M.aluminium(),
  titanium: () => M.titanium(),
  darkMetal: () => M.darkMetal(),
  gunmetal: () => M.gunmetal(),
};
