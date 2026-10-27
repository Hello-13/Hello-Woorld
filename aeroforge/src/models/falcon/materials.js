// Falcon Heavy surface finishes. Block 5 livery: white-painted aluminium-lithium tanks with
// friction-stir weld seams, black thermal-protection paint on the interstage, the booster forward
// sections, the landing legs and the first-stage raceways (Block 5; on Block 5 Falcon Heavy centre
// cores the interstage is black like a Falcon 9's, as on Arabsat-6A and STP-2 in 2019), bare cast
// titanium grid fins, white composite nose cones and fairing. The white is a matte paint (no clearcoat, albedo ≈ 0.7) so that under the pad's
// floodlights it reads as painted white rather than glowing; roughness stays ≥ 0.3 on the big
// curved shells so highlights stay stable.

import * as THREE from 'three';
import { tankSkin, carbonWeave, concrete } from '../../engine/surface.js';
import { rng } from '../../engine/materials.js';

const cache = new Map();
const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

// White exterior finishes. The launch-pad look adds three floodlights to the dawn sky and sun, which
// lift the lower white skins past the renderer's bloom threshold (diffuse HDR luminance ≈ 2.1
// measured on the side boosters, threshold 1.9; with the floods off the peak is 1.8), so the vehicle
// seemed to glow. While the floods are on, these finishes are toned to 74 % so the vehicle reads as
// painted white; elsewhere they are at full albedo.
const painted = new Set();
const paint = (m) => { painted.add(m); m.userData.albedo = m.color.clone(); return m; };
/** Scale every white exterior finish (1 = full albedo). */
export function setPaintTone(k) {
  for (const m of painted) m.color.copy(m.userData.albedo).multiplyScalar(k);
}

function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Stage paint: v runs 0 → 1 up the stage (canvas bottom → top), u = 0.5 faces +z.
 * seams: heights (0..1) of circumferential friction-stir welds between barrel sections.
 * soot: fraction of the stage (from the base) darkened by re-entry and landing-burn soot.
 * word: { text, v0, v1, u } a vertical wordmark reading bottom-to-top.
 */
export function stagePaint(key, { seams = [], soot = 0, streaks = 0, word = null, seed = 3, base = '#d9dcde' } = {}) {
  return once(`paint.${key}`, () => {
    const map = canvasTex(512, 2048, (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const r = rng(seed);
      // faint paint mottling between panels
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${196 + r() * 26},${200 + r() * 26},${204 + r() * 26},0.08)`;
        ctx.fillRect(0, r() * h, w, 10 + r() * 60);
      }
      if (soot > 0) {
        const g = ctx.createLinearGradient(0, h, 0, h * (1 - soot));
        g.addColorStop(0, 'rgba(58,52,46,0.85)');
        g.addColorStop(0.35, 'rgba(84,76,68,0.45)');
        g.addColorStop(1, 'rgba(110,100,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, h * (1 - soot), w, h * soot);
      }
      for (let i = 0; i < streaks; i++) {
        const x = r() * w;
        const len = h * (0.15 + r() * 0.5);
        const y0 = h * (0.02 + r() * 0.2);
        const sg = ctx.createLinearGradient(0, y0, 0, y0 + len);
        sg.addColorStop(0, `rgba(70,62,54,${0.18 + r() * 0.2})`);
        sg.addColorStop(1, 'rgba(70,62,54,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x, y0, 2 + r() * 7, len);
      }
      ctx.strokeStyle = 'rgba(132,138,144,0.5)';
      ctx.lineWidth = 3;
      for (const s of seams) { const y = h * (1 - s); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      if (word) {
        ctx.save();
        const v = (word.v0 + word.v1) / 2;
        ctx.translate(w * (word.u ?? 0.5), h * (1 - v));
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = word.color || '#111317';
        const len = (word.v1 - word.v0) * h;
        ctx.font = `700 ${Math.round(word.size || 64)}px "Archivo", "Arial", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // stretch the wordmark to the requested length
        const m = ctx.measureText(word.text).width;
        ctx.scale(len / m, 1);
        ctx.fillText(word.text, 0, 0);
        ctx.restore();
      }
    });
    map.flipY = true;
    return map;
  });
}

/**
 * Painted aluminium-lithium tank skin with a stage paint map. The shared tank skin's weld and
 * isogrid normal map gives the surface detail; its satin roughness map (0.3–0.46) is left out
 * because it multiplies the material roughness down to ≈ 0.3, which turned the pad floodlights
 * into hot specular spots (HDR ≈ 40) on the white paint. Falcon's paint is close to matte.
 */
export function tankMaterial(paintMap, lengthM) {
  const sk = tankSkin();
  const normalMap = sk.normalMap.clone(); normalMap.repeat.set(10, lengthM / 3.4); normalMap.wrapT = THREE.RepeatWrapping; normalMap.needsUpdate = true;
  return paint(new THREE.MeshStandardMaterial({
    color: 0xffffff, map: paintMap, normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.68, metalness: 0.02,
  }));
}

function carbonSet(rx, ry) {
  const c = carbonWeave();
  const out = {};
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    if (!c[k]) continue;
    const t = c[k].clone(); t.repeat.set(rx, ry); t.needsUpdate = true; out[k] = t;
  }
  return out;
}

export const FM = {
  /** Interstage / booster forward section: carbon composite under black thermal paint. */
  blackTPS: () => once('blackTPS', () => {
    const c = carbonSet(40, 12);
    return new THREE.MeshStandardMaterial({ color: 0x1b1c1e, normalMap: c.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.62, metalness: 0.15 });
  }),
  /** Inside face of composite shells (seen through cutaways and from below). */
  compositeInner: () => once('compInner', () => new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.8, metalness: 0.1, side: THREE.BackSide })),
  /** Block 5 landing legs and first-stage raceways: carbon / aluminium honeycomb under black thermal protection. */
  legBlack: () => once('legBlack', () => {
    const c = carbonSet(3, 14);
    return new THREE.MeshStandardMaterial({ color: 0x1e1f21, normalMap: c.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.6, metalness: 0.12 });
  }),
  racewayBlack: () => once('racewayBlack', () => new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.66, metalness: 0.1 })),
  /** Aluminium-honeycomb crush core inside a leg piston. */
  crushCore: () => once('crushCore', () => new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.55, metalness: 0.6 })),
  /** Insulation lagging over the second-stage igniter lines. */
  lagging: () => once('lagging', () => new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.9, metalness: 0.0 })),
  lens: () => once('lens', () => new THREE.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.08, metalness: 0.6 })),
  legCarbon: () => once('legCarbon', () => {
    const c = carbonSet(3, 14);
    return new THREE.MeshPhysicalMaterial({ color: 0x9a9da2, map: c.map, normalMap: c.normalMap, roughness: 0.55, metalness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  }),
  parafoil: () => once('parafoil', () => new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.85, metalness: 0.0 })),
  cable: () => once('cable', () => new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.75, metalness: 0.1 })),
  safety: () => once('safety', () => new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.55, metalness: 0.4 })),
  battery: () => once('battery', () => new THREE.MeshStandardMaterial({ color: 0x4a5a4c, roughness: 0.55, metalness: 0.4 })),
  /** Grey mission-extension-kit band over the second-stage RP-1 tank (absorbs sunlight on long coasts). */
  mekGrey: () => once('mekGrey', () => new THREE.MeshStandardMaterial({ color: 0x6b6e70, roughness: 0.7, metalness: 0.05 })),
  titanium: () => once('ti', () => new THREE.MeshStandardMaterial({ color: 0x8b8580, roughness: 0.5, metalness: 0.95 })),
  whiteComposite: () => once('whiteComp', () => paint(new THREE.MeshStandardMaterial({ color: 0xd6d8da, roughness: 0.62, metalness: 0.02 }))),
  fairing: () => once('fairing', () => paint(new THREE.MeshStandardMaterial({ color: 0xd8dadb, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide }))),
  heatShield: () => once('heatShield', () => new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9, metalness: 0.05 })),
  boot: () => once('boot', () => new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })),
  raceway: () => once('raceway', () => paint(new THREE.MeshStandardMaterial({ color: 0xd6d9db, roughness: 0.65, metalness: 0.05 }))),
  alu: () => once('alu', () => new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.42, metalness: 0.9 })),
  aluDark: () => once('aluDark', () => new THREE.MeshStandardMaterial({ color: 0x80878e, roughness: 0.5, metalness: 0.85 })),
  domeAlu: () => once('domeAlu', () => new THREE.MeshStandardMaterial({ color: 0xaab1b7, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide })),
  copv: () => once('copv', () => {
    const c = carbonSet(4, 3);
    return new THREE.MeshPhysicalMaterial({ color: 0x55585e, map: c.map, normalMap: c.normalMap, roughness: 0.5, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  }),
  steelLine: () => once('steelLine', () => new THREE.MeshStandardMaterial({ color: 0x9da3a8, roughness: 0.35, metalness: 0.95 })),
  inconel: () => once('inconel', () => new THREE.MeshStandardMaterial({ color: 0x6d6258, roughness: 0.45, metalness: 0.9 })),
  copper: () => once('copper', () => new THREE.MeshStandardMaterial({ color: 0xa8683e, roughness: 0.4, metalness: 0.95 })),
  pump: () => once('pump', () => new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.4, metalness: 0.9 })),
  black: () => once('black', () => new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.7, metalness: 0.2 })),
  avionics: () => once('avionics', () => new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.55, metalness: 0.5 })),
  gold: () => once('gold', () => new THREE.MeshStandardMaterial({ color: 0xc89b45, roughness: 0.4, metalness: 1.0 })),
  blanket: () => once('blanket', () => new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })),
  niobium: () => once('niobium', () => new THREE.MeshStandardMaterial({ color: 0x302b2a, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide })),
  /** Merlin 1D / MVac regeneratively cooled nozzle and chamber jacket: a uniform dark grey, faintly blued by heat on a flown engine, no copper showing. */
  nozzle: () => once('nozzle', () => new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.46, metalness: 0.8, side: THREE.DoubleSide })),
  bellInner: () => once('bellInner', () => new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6, metalness: 0.7, side: THREE.BackSide })),
  // ground support
  padSteel: () => once('padSteel', () => new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.6, metalness: 0.55 })),
  /** The fixed service structure: shuttle-era steel repainted black by SpaceX in 2017. */
  fssSteel: () => once('fssSteel', () => new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.62, metalness: 0.5 })),
  /** SpaceX's transporter-erector: black-painted steel, the darkest thing on the pad beside the white rocket. */
  teBlack: () => once('teBlack', () => new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.55, metalness: 0.55 })),
  /** Light-grey ground equipment (hydraulic unit, tail service masts, crew access arm). */
  teWhite: () => once('teWhite', () => new THREE.MeshStandardMaterial({ color: 0xb9bcbd, roughness: 0.6, metalness: 0.3 })),
  refractory: () => once('refractory', () => new THREE.MeshStandardMaterial({ color: 0x34322e, roughness: 0.95, metalness: 0.02 })),   // soot-darkened refractory brick
  deflector: () => once('deflector', () => new THREE.MeshStandardMaterial({ color: 0x5c5955, roughness: 0.9, metalness: 0.1 })),   // scorched steel and refractory concrete
  water: () => once('waterPipe', () => new THREE.MeshStandardMaterial({ color: 0xb7b9b2, roughness: 0.5, metalness: 0.6 })),
  hardstand: () => once('hardstand', () => {
    const c = concrete({ seed: 11 });           // same tile as the pad floor (cached), 5 m tiles so the mottling reads
    const out = {};
    for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = c[k].clone(); t.repeat.set(1 / 5, 1 / 5); t.needsUpdate = true; out[k] = t; }
    return new THREE.MeshStandardMaterial({ color: 0x9e9b94, ...out, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, metalness: 0 });
  }),
  /**
   * The same weathered concrete with per-vertex grime: the hardstand top, lip and ramp carry a colour
   * attribute (scorch beside the trench and at its exits, rain streaks, faded patches).
   */
  hardstandWeathered: () => once('hardstandW', () => {
    const c = concrete({ seed: 11 });
    const out = {};
    for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = c[k].clone(); t.repeat.set(1 / 5, 1 / 5); t.needsUpdate = true; out[k] = t; }
    return new THREE.MeshStandardMaterial({ color: 0xa6a39c, ...out, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, metalness: 0, vertexColors: true });
  }),
  /** Grassed earth embankment of the pad mound (per-vertex colour: worn to sand where the exhaust exits). */
  embankment: () => once('embankment', () => {
    const c = concrete({ seed: 11 });
    const n = c.normalMap.clone(); n.repeat.set(1 / 6, 1 / 6); n.needsUpdate = true;
    const r = c.roughnessMap.clone(); r.repeat.set(1 / 6, 1 / 6); r.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: 0x6e7456, normalMap: n, roughnessMap: r, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 1, metalness: 0, vertexColors: true });
  }),
};
