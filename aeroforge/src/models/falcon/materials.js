// Falcon Heavy surface finishes. Block 5 livery: white-painted aluminium-lithium tanks with
// friction-stir weld seams, black thermal-protection paint on the interstage and booster forward
// sections, black carbon landing legs, bare cast titanium grid fins, white composite nose cones
// and fairing. Roughness stays ≥ 0.3 on the big curved shells so highlights stay stable.

import * as THREE from 'three';
import { tankSkin, carbonWeave, concrete } from '../../engine/surface.js';
import { rng } from '../../engine/materials.js';

const cache = new Map();
const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

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
export function stagePaint(key, { seams = [], soot = 0, streaks = 0, word = null, seed = 3, base = '#eef0f1' } = {}) {
  return once(`paint.${key}`, () => {
    const map = canvasTex(512, 2048, (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const r = rng(seed);
      // faint paint mottling between panels
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(${200 + r() * 30},${205 + r() * 30},${210 + r() * 30},0.08)`;
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

/** Painted aluminium-lithium tank skin with a stage paint map. */
export function tankMaterial(paintMap, lengthM) {
  const sk = tankSkin();
  const normalMap = sk.normalMap.clone(); normalMap.repeat.set(10, lengthM / 3.4); normalMap.wrapT = THREE.RepeatWrapping; normalMap.needsUpdate = true;
  const roughnessMap = sk.roughnessMap.clone(); roughnessMap.repeat.set(4, lengthM / 6); roughnessMap.wrapT = THREE.RepeatWrapping; roughnessMap.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: paintMap, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.85, metalness: 0.04, clearcoat: 0.3, clearcoatRoughness: 0.35,
  });
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
  legCarbon: () => once('legCarbon', () => {
    const c = carbonSet(3, 14);
    return new THREE.MeshPhysicalMaterial({ color: 0x9a9da2, map: c.map, normalMap: c.normalMap, roughness: 0.55, metalness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  }),
  titanium: () => once('ti', () => new THREE.MeshStandardMaterial({ color: 0x8b8580, roughness: 0.5, metalness: 0.95 })),
  whiteComposite: () => once('whiteComp', () => new THREE.MeshPhysicalMaterial({ color: 0xf1f2f3, roughness: 0.55, metalness: 0.02, clearcoat: 0.25, clearcoatRoughness: 0.4 })),
  fairing: () => once('fairing', () => new THREE.MeshPhysicalMaterial({ color: 0xf3f4f5, roughness: 0.5, metalness: 0.02, clearcoat: 0.25, clearcoatRoughness: 0.4, side: THREE.DoubleSide })),
  heatShield: () => once('heatShield', () => new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9, metalness: 0.05 })),
  boot: () => once('boot', () => new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })),
  raceway: () => once('raceway', () => new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.6, metalness: 0.05 })),
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
  bellInner: () => once('bellInner', () => new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6, metalness: 0.7, side: THREE.BackSide })),
  // ground support
  padSteel: () => once('padSteel', () => new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.6, metalness: 0.55 })),
  fssSteel: () => once('fssSteel', () => new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: 0.6, metalness: 0.45 })),
  teWhite: () => once('teWhite', () => new THREE.MeshStandardMaterial({ color: 0xd4d6d7, roughness: 0.55, metalness: 0.3 })),
  refractory: () => once('refractory', () => new THREE.MeshStandardMaterial({ color: 0x5a554f, roughness: 0.95, metalness: 0.02 })),
  deflector: () => once('deflector', () => new THREE.MeshStandardMaterial({ color: 0x8f8a83, roughness: 0.9, metalness: 0.1 })),
  water: () => once('waterPipe', () => new THREE.MeshStandardMaterial({ color: 0xb7b9b2, roughness: 0.5, metalness: 0.6 })),
  hardstand: () => once('hardstand', () => {
    const c = concrete({ seed: 23 });
    const out = {};
    for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = c[k].clone(); t.repeat.set(1 / 12, 1 / 12); t.needsUpdate = true; out[k] = t; }
    return new THREE.MeshStandardMaterial({ color: 0xb4b0a8, ...out, roughness: 1, metalness: 0 });
  }),
};
