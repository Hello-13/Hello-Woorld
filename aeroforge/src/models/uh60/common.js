// Shared helpers and materials for the UH-60M Black Hawk model.
// Axes: x forward, y up, z right (starboard). Metres, real scale. The ground is y = 0 and the
// main-rotor shaft axis passes through x = 0 at the hub (3.33 m up).

import * as THREE from 'three';
import { mergeGeometries } from '../../engine/geometry.js';
import { aircraftSkin } from '../../engine/surface.js';

export const DEG = Math.PI / 180;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/** Monotone piecewise-cubic (Fritsch–Carlson) interpolation over [[x, y], …] sorted by x. */
export function pchip(keys, x) {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && x > keys[i + 1][0]) i++;
  const slope = (k) => (keys[k + 1][1] - keys[k][1]) / (keys[k + 1][0] - keys[k][0]);
  const tangent = (k) => {
    if (k === 0) return slope(0);
    if (k === n - 1) return slope(n - 2);
    const a = slope(k - 1), b = slope(k);
    if (a * b <= 0) return 0;
    const h0 = keys[k][0] - keys[k - 1][0], h1 = keys[k + 1][0] - keys[k][0];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const [x0, y0] = keys[i], [x1, y1] = keys[i + 1];
  const h = x1 - x0, t = (x - x0) / h;
  const m0 = tangent(i) * h, m1 = tangent(i + 1) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

/** Merge any mix of geometries into one indexed geometry with position/normal/uv. */
export function merge(list) {
  const out = [];
  for (const src of list.flat()) {
    if (!src) continue;
    let g = src;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) {
      const idx = new Array(g.attributes.position.count);
      for (let i = 0; i < idx.length; i++) idx[i] = i;
      g.setIndex(idx);
    }
    out.push(g);
  }
  if (out.length === 1) return out[0];
  const m = mergeGeometries(out, false);
  if (!m) throw new Error('UH-60: geometry merge failed (attribute mismatch)');
  return m;
}

/** Place a geometry: rotate (Euler, radians) then translate. Returns the geometry. */
export function place(g, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], order = 'XYZ') {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, order)));
  g.translate(x, y, z);
  return g;
}

export const box = (w, h, d, at, rot) => place(new THREE.BoxGeometry(w, h, d), at, rot);
/** Cylinder along +y by default; axis: 'x' | 'y' | 'z'. */
export function cyl(r0, r1, h, at = [0, 0, 0], axis = 'y', seg = 16, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(...at);
  return g;
}
export const sphere = (r, at, ws = 14, hs = 10) => place(new THREE.SphereGeometry(r, ws, hs), at);

/** Cylinder from p0 to p1 (arrays or Vector3). */
export function tube(p0, p1, r = 0.02, seg = 8) {
  const a = p0.isVector3 ? p0.clone() : V3(...p0), b = p1.isVector3 ? p1.clone() : V3(...p1);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, Math.max(len, 1e-4), seg);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const m = a.add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Bent pipe through a list of points (hydraulic/fuel lines, harnesses). */
export function pipe(points, r = 0.012, seg = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(...p))), false, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), r, seg, false);
}

/** Rectangular bar from p0 to p1 with width w (perpendicular, horizontal-ish) and height h. */
export function bar(p0, p1, w = 0.05, h = w) {
  const a = V3(...p0), b = V3(...p1);
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, len, h);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Mirror a geometry to the other side (z → −z), fixing the winding. */
export function mirror(g) {
  const m = g.clone();
  m.scale(1, 1, -1);
  if (m.index) {
    const idx = m.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    m.index.needsUpdate = true;
  }
  m.computeVertexNormals();
  return m;
}

/** Unit cylinder (radius 1, height 1, along +y from 0 to 1) for rods re-aimed every frame. */
export const unitRod = (seg = 10) => new THREE.CylinderGeometry(1, 1, 1, seg).translate(0, 0.5, 0);
const _up = V3(0, 1, 0), _d = V3();
/** Aim a unitRod mesh from a to b (in the mesh parent's frame) with radius r. */
export function aimRod(m, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / Math.max(len, 1e-6)));
  m.scale.set(r, len, r);
}

// ------------------------------------------------------------------------------- materials

function tiled(set, r) {
  const out = {};
  for (const [k, t] of Object.entries(set)) {
    if (!t) continue;
    const c = t.clone();
    c.repeat.set(r, r);
    c.anisotropy = 8;
    c.needsUpdate = true;
    out[k] = c;
  }
  return out;
}
const std = (key, p) => once(key, () => new THREE.MeshStandardMaterial(p));

/** Canvas texture helper. */
export function canvasTex(key, w, h, draw, { srgb = true } = {}) {
  return once(`tex.${key}`, () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

export const MAT = {
  // US Army lusterless green (FS 34031 family) with panel seams and fasteners in the normal map
  paint: () => once('h.paint', () => {
    const t = tiled(aircraftSkin({ seed: 61, sawtooth: false }), 1 / 2.2);
    return new THREE.MeshStandardMaterial({ color: 0x434b39, ...t, normalScale: new THREE.Vector2(0.32, 0.32), roughness: 1.18, metalness: 0.04 });
  }),
  paintDark: () => std('h.paintDark', { color: 0x30362b, roughness: 0.78, metalness: 0.06 }),
  paintPlain: () => std('h.paintPlain', { color: 0x434b39, roughness: 0.74, metalness: 0.04 }),
  interior: () => std('h.interior', { color: 0x6d7268, roughness: 0.86, metalness: 0.02, side: THREE.BackSide }),
  interiorFront: () => std('h.interiorFront', { color: 0x666b62, roughness: 0.86, metalness: 0.02 }),
  primer: () => std('h.primer', { color: 0x8c9570, roughness: 0.7, metalness: 0.15 }),      // zinc-chromate-green structure
  structure: () => std('h.structure', { color: 0x9aa09a, roughness: 0.55, metalness: 0.55 }),
  casting: () => std('h.casting', { color: 0x7f857c, roughness: 0.52, metalness: 0.55 }),     // magnesium/aluminium gearbox cases
  steel: () => std('h.steel', { color: 0xa7adb3, roughness: 0.32, metalness: 0.95 }),
  titanium: () => std('h.titanium', { color: 0x9da4aa, roughness: 0.34, metalness: 0.95 }),
  darkMetal: () => std('h.darkMetal', { color: 0x2d3033, roughness: 0.45, metalness: 0.8 }),
  hot: () => std('h.hot', { color: 0x5d544c, roughness: 0.48, metalness: 0.85 }),
  rubber: () => std('h.rubber', { color: 0x161616, roughness: 0.9, metalness: 0 }),
  elastomer: () => std('h.elastomer', { color: 0x1c1c1c, roughness: 0.75, metalness: 0 }),
  blade: () => std('h.blade', { color: 0x2e3230, roughness: 0.62, metalness: 0.08 }),
  black: () => std('h.black', { color: 0x1a1c1e, roughness: 0.6, metalness: 0.2 }),
  avionics: () => std('h.avionics', { color: 0x25292c, roughness: 0.55, metalness: 0.35 }),
  fabric: () => std('h.fabric', { color: 0x5f5c45, roughness: 0.95, metalness: 0 }),
  seat: () => std('h.seat', { color: 0x2b2d2f, roughness: 0.8, metalness: 0.1 }),
  armour: () => std('h.armour', { color: 0x5a5e5c, roughness: 0.6, metalness: 0.3 }),
  fuelCell: () => std('h.fuelCell', { color: 0x7c6440, roughness: 0.85, metalness: 0 }),
  hydraulic: () => std('h.hydraulic', { color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 }),
  copper: () => std('h.copper', { color: 0xb87a4b, roughness: 0.35, metalness: 0.9 }),
  wiring: () => std('h.wiring', { color: 0x202224, roughness: 0.7, metalness: 0.05 }),
  yellow: () => std('h.yellow', { color: 0xc9a227, roughness: 0.6, metalness: 0.1 }),
  red: () => std('h.red', { color: 0x8e2420, roughness: 0.6, metalness: 0.1 }),
  intake: () => std('h.intake', { color: 0x0d0e0f, roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide }),
  // cockpit transparencies: tinted acrylic/glass, rough enough not to sparkle on the large curves
  glass: () => once('h.glass', () => new THREE.MeshPhysicalMaterial({
    color: 0x2a3a40, roughness: 0.1, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.12,
    transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.9,
  })),
  screen: () => std('h.screen', { color: 0x0a1410, emissive: 0x2a8f62, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 }),
  screenAmber: () => std('h.screenAmber', { color: 0x140c04, emissive: 0xb07a24, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.1 }),
  navRed: () => std('h.navRed', { color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 5 }),
  navGreen: () => std('h.navGreen', { color: 0x002200, emissive: 0x2bff6a, emissiveIntensity: 5 }),
  navWhite: () => std('h.navWhite', { color: 0x222222, emissive: 0xffffff, emissiveIntensity: 3 }),
  formation: () => std('h.formation', { color: 0x0c1a10, emissive: 0x7dffa0, emissiveIntensity: 1.6 }),
  lens: () => std('h.lens', { color: 0xdfe6ea, roughness: 0.15, metalness: 0.2, emissive: 0x333333, emissiveIntensity: 0.4 }),
};

/** A fresh anti-collision strobe material (each light animates its own intensity). */
export const strobeMat = () => new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });

/** Tail-drive layout shared by the drive and tail modules (world metres). */
export const TAIL = {
  cant: 20 * DEG,                 // tail-rotor shaft canted 20° up from horizontal (pylon leans to port)
  shearY0: 2.3,                   // the pylon starts leaning above this height
  igb: [-8.33, 2.05, 0],          // 42° intermediate gearbox at the base of the pylon leading edge
  tgb: [-9.93, 3.44, -0.415],     // 90° tail gearbox at the top of the pylon
  hub: [-9.93, 3.56, -0.085],     // tail-rotor hub, right of the pylon
};
/** Lateral lean of the pylon mid-plane at height y. */
export const pylonLean = (y) => -Math.max(0, y - TAIL.shearY0) * Math.tan(TAIL.cant);
