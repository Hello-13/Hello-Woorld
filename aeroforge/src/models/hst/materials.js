// Hubble-specific materials: the silvered Teflon multi-layer insulation that gives the telescope
// its crinkled-foil look, the white NOBL covers added on servicing missions, Z-93-style white
// radiator paint, flat-black baffles, the aluminised mirrors, graphite-epoxy, gold-iridite
// electronics boxes, yellow EVA handrails and the SA3 solar-cell panels.
//
// Glossy surfaces stay at roughness ≥ 0.08 (only the real mirrors go that low) so the render
// core's specular antialiasing has something to work with; nothing here emits light.

import * as THREE from 'three';
import { mliSurface } from '../../engine/surface.js';
import { rng } from '../../engine/materials.js';

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Silvered-Teflon blanket: crinkle streaks, stitched quilting and the odd darker patch. */
function mliAlbedo(seed, { base = [196, 200, 205], seams = 4, patches = 3 } = {}) {
  return (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = `rgb(${base.join(',')})`;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, l = 6 + r() * 46, a = r() * Math.PI;
      const v = r();
      ctx.strokeStyle = v > 0.55 ? `rgba(250,252,255,${0.12 + r() * 0.3})` : `rgba(70,76,84,${0.08 + r() * 0.22})`;
      ctx.lineWidth = 0.8 + r() * 2.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    // blanket seams and tie-down stitching
    ctx.strokeStyle = 'rgba(60,64,70,0.55)';
    ctx.lineWidth = 3;
    for (let k = 0; k <= seams; k++) {
      const x = (k / seams) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(80,84,90,0.6)';
    for (let k = 0; k < seams; k++) for (let j = 0; j < 8; j++) {
      ctx.beginPath(); ctx.arc(((k + 0.5) / seams) * w, ((j + 0.5) / 8) * h, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // weathered / patched areas (the original outer layer cracked after years of UV and atomic oxygen)
    for (let k = 0; k < patches; k++) {
      const x = r() * w, y = r() * h, pw = 30 + r() * 90, ph = 20 + r() * 60;
      ctx.fillStyle = `rgba(${r() > 0.5 ? '150,146,132' : '220,224,228'},0.35)`;
      ctx.fillRect(x, y, pw, ph);
    }
  };
}

export const HM = {
  /** Silvered Teflon MLI on the light shield, forward shell and aft shroud. */
  mli: () => once('mli', () => {
    const n = mliSurface({ seed: 41 });
    const map = canvasTex(512, 512, mliAlbedo(5), { repeat: [6, 2] });
    const normalMap = n.normalMap.clone(); normalMap.repeat.set(14, 4); normalMap.needsUpdate = true;
    const roughnessMap = n.roughnessMap.clone(); roughnessMap.repeat.set(9, 3); roughnessMap.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.6, metalness: 0.55, side: THREE.DoubleSide });
  }),
  /** Light shield blanket: panel seams run lengthwise, more weathering toward the aperture. */
  mliShield: () => once('mliShield', () => {
    const n = mliSurface({ seed: 43 });
    const map = canvasTex(512, 512, mliAlbedo(9, { base: [190, 194, 199], seams: 3, patches: 6 }), { repeat: [8, 2] });
    const normalMap = n.normalMap.clone(); normalMap.repeat.set(16, 4); normalMap.needsUpdate = true;
    const roughnessMap = n.roughnessMap.clone(); roughnessMap.repeat.set(10, 3); roughnessMap.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.62, metalness: 0.55, side: THREE.DoubleSide });
  }),
  /** New Outer Blanket Layer: stainless-framed white covers fitted over bay doors (2002, 2009). */
  nobl: () => once('nobl', () => {
    const map = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e6e8ea'; ctx.fillRect(0, 0, w, h);
      const r = rng(17);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '160,166,172'},0.12)`; ctx.fillRect(r() * w, r() * h, 4 + r() * 22, 2 + r() * 8); }
      ctx.strokeStyle = 'rgba(120,126,132,0.7)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = 'rgba(90,96,102,0.8)';
      for (let k = 0; k < 8; k++) for (const [x, y] of [[k * w / 8 + 16, 8], [k * w / 8 + 16, h - 8], [8, k * h / 8 + 16], [w - 8, k * h / 8 + 16]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    });
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.48, metalness: 0.3 });
  }),
  /** Equipment-section bay doors: radiator panels under silvered Teflon tape. */
  bayDoor: () => once('bayDoor', () => {
    const map = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c9cdd1'; ctx.fillRect(0, 0, w, h);
      const r = rng(23);
      for (let j = 0; j < 12; j++) {            // tape strips
        const y = (j / 12) * h;
        ctx.fillStyle = `rgba(${200 + Math.floor(r() * 40)},${204 + Math.floor(r() * 40)},${210 + Math.floor(r() * 40)},0.65)`;
        ctx.fillRect(0, y + 1, w, h / 12 - 2);
      }
      ctx.strokeStyle = 'rgba(70,74,80,0.8)'; ctx.lineWidth = 5; ctx.strokeRect(2, 2, w - 4, h - 4);
    });
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.4, metalness: 0.62 });
  }),
  /** White thermal-control paint on instrument radiators. */
  radiator: () => once('radiator', () => new THREE.MeshStandardMaterial({ color: 0xeef0f1, roughness: 0.72, metalness: 0.0 })),
  /** Flat black stray-light paint on the baffles and the inside of the light shield. */
  black: () => once('black', () => new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })),
  /** Aluminium + MgF₂ mirror coating (a real mirror, so it may be glossy). */
  mirror: () => once('mirror', () => new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.08, metalness: 1.0, side: THREE.DoubleSide })),
  /** Corning ULE glass seen at the cut edges and the egg-crate core. */
  ule: () => once('ule', () => new THREE.MeshStandardMaterial({ color: 0xb9c7cf, roughness: 0.34, metalness: 0.05, side: THREE.DoubleSide })),
  /** Graphite-epoxy tubes and frames. */
  grEp: () => once('grEp', () => new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.46, metalness: 0.35 })),
  /** Titanium fittings and the main ring. */
  ti: () => once('ti', () => new THREE.MeshStandardMaterial({ color: 0x9da4ab, roughness: 0.34, metalness: 0.92 })),
  /** Bare aluminium structure. */
  al: () => once('al', () => new THREE.MeshStandardMaterial({ color: 0xbcc2c8, roughness: 0.4, metalness: 0.9 })),
  /** Gold chromate-conversion (Iridite) electronics boxes. */
  iridite: () => once('iridite', () => new THREE.MeshStandardMaterial({ color: 0xb59a5c, roughness: 0.42, metalness: 0.75 })),
  /** Black-anodised electronics boxes. */
  box: () => once('box', () => new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.55, metalness: 0.45 })),
  /** Science-instrument enclosures: painted aluminium under grey blankets. */
  siGrey: () => once('siGrey', () => new THREE.MeshStandardMaterial({ color: 0xa7acb1, roughness: 0.55, metalness: 0.35 })),
  /** Gold Kapton blankets (antenna dishes, some instrument faces). */
  kapton: () => once('kapton', () => new THREE.MeshStandardMaterial({ color: 0xc9953f, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide })),
  /** Yellow EVA handrails and foot-restraint sockets. */
  handrail: () => once('handrail', () => new THREE.MeshStandardMaterial({ color: 0xe1b12c, roughness: 0.5, metalness: 0.1 })),
  /** Battery cells: NiH₂ pressure vessels. */
  cell: () => once('cell', () => new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.38, metalness: 0.85 })),
  /** Reaction-wheel rotors (seen in cutaway). */
  rotor: () => once('rotor', () => new THREE.MeshStandardMaterial({ color: 0x8c6a45, roughness: 0.34, metalness: 0.95 })),
  /** Magnetic torquer bar covers. */
  mtb: () => once('mtb', () => new THREE.MeshStandardMaterial({ color: 0xd6d9dc, roughness: 0.5, metalness: 0.4 })),
  /** SA3 front: gallium-arsenide cells behind cover glass, silver interconnects. */
  sa3Cells: () => once('sa3Cells', () => {
    const map = canvasTex(512, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#9aa1a8'; ctx.fillRect(0, 0, w, h);
      const r = rng(31);
      const cols = 8, rows = 22, gap = 2;
      const cw = w / cols, ch = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const t = 26 + r() * 10;
        const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
        g.addColorStop(0, `rgb(${t * 0.9},${t * 0.75},${t * 2.3})`);
        g.addColorStop(1, `rgb(${t * 0.6},${t * 0.55},${t * 1.8})`);
        ctx.fillStyle = g;
        ctx.fillRect(i * cw + gap, j * ch + gap, cw - gap * 2, ch - gap * 2);
        ctx.fillStyle = 'rgba(200,206,214,0.35)';
        ctx.fillRect(i * cw + gap, j * ch + ch * 0.5, cw - gap * 2, 1);
      }
      ctx.strokeStyle = '#c6cbd0'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    });
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.26, metalness: 0.4 });
  }),
  /** SA3 back: white-painted honeycomb substrate. */
  sa3Back: () => once('sa3Back', () => new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.62, metalness: 0.15 })),
  /** Antenna reflector front: white-painted graphite. */
  dish: () => once('dish', () => new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide })),
  /** Black-and-white rendezvous target pattern on the soft-capture mechanism. */
  target: () => once('target', () => {
    const map = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w / 2, h / 2); ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
    });
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.6, metalness: 0.0 });
  }),
  /** Light-path visualisation: additive, unlit, drawn over the X-ray / Systems views. */
  ray: () => once('ray', () => new THREE.MeshBasicMaterial({ color: 0xffc56a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
  beam: () => once('beam', () => new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })),
  focus: () => once('focus', () => new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
};
