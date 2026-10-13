// Gear geometry for the GE90-115B accessory drive: toothed spur and bevel gears, and the layout
// of the accessory gearbox's spur-gear train. Lathe frame as in layout.js (engine axis +y,
// x = r·sin(phi), z = r·cos(phi)).

import * as THREE from 'three';
import { atPhi, merge } from './geom.js';

const TAU = Math.PI * 2;

/**
 * A toothed gear with its axis along +y, centred at the origin: a cylinder (or, for a bevel, a
 * frustum) whose rim alternates between tip and root radius in trapezoidal teeth.
 * r: pitch radius (or [top, bottom] radii for a bevel); face: face width; teeth defaults to a
 * module of about 3 mm.
 */
export function toothedGear(r, face, { teeth, depth = 0.0065, bore = 0 } = {}) {
  const [rt, rb] = Array.isArray(r) ? r : [r, r];
  const T = teeth ?? Math.max(10, Math.round((TAU * Math.max(rt, rb)) / 0.0095));
  const g = new THREE.CylinderGeometry(rt + depth / 2, rb + depth / 2, face, 4 * T, 1).toNonIndexed();
  const pos = g.attributes.position;
  const step = TAU / (4 * T);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), rr = Math.hypot(x, z);
    if (rr < 1e-7) continue;
    const k = ((Math.round(Math.atan2(x, z) / step) % (4 * T)) + 4 * T) % (4 * T);
    if (k % 4 >= 2) { const s = (rr - depth) / rr; pos.setX(i, x * s); pos.setZ(i, z * s); }
  }
  g.computeVertexNormals();
  if (!bore) return g;
  return merge([g, new THREE.CylinderGeometry(bore, bore, face * 1.6, 10)]);
}

/** A gear (axis parallel to the engine axis) at (r, y, phi). */
export function axialGear(r, y, phi, pitchR, face, opts) {
  const g = toothedGear(pitchR, face, opts);
  g.translate(r, y, 0);
  return atPhi(g, phi);
}

/**
 * Spur-gear train of the accessory gearbox. Pads sit round the crescent at fixed angles (their
 * accessories hang on the gearbox faces); each pad shaft carries one gear, and idlers fill the
 * gaps so that neighbouring pitch circles touch. Gears with radius null are sized to touch the
 * gear before them. Returns [{ phi, r, kind, name }] in order round the gearbox.
 */
export function agbTrain(R, pads, { maxIdler = 0.06, minGap = 0.008 } = {}) {
  const out = [];
  const s = (phi) => R * phi;                       // arc length; the arc is nearly straight over a gear pitch
  let prev = null;
  for (const p of pads) {
    const g = { ...p };
    if (prev) {
      const d = s(g.phi) - s(prev.phi);
      if (g.r == null) g.r = Math.max(0.02, d - prev.r);
      const gap = d - prev.r - g.r;
      if (gap > minGap) {
        const n = gap / 2 <= maxIdler ? 1 : 2;
        const ri = gap / (2 * n);
        let at = s(prev.phi) + prev.r;
        for (let k = 0; k < n; k++) { out.push({ phi: (at + ri) / R, r: ri, kind: 'idler', name: 'idler' }); at += 2 * ri; }
      }
    } else if (g.r == null) g.r = 0.03;
    out.push(g);
    prev = g;
  }
  return out;
}
