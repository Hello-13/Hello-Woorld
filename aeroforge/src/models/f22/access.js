// F-22A maintenance access: the flush, saw-tooth-edged panels a crew chief opens most often — the
// forward avionics-bay doors under the chines, the AMAD bay doors in the belly, the FADEC panels on the
// lower aft fuselage walls and the engine-bay panels on the upper deck. Every panel seam is a low-observable maintenance
// item, so the F-22 has far fewer of them than an F-15. Positions are approximate (from photographs).

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, toothedGrid } from './util.js';
import { loftStationsA } from './airframe.js';

const { X, lerp, M } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const range = (a, b, n) => [...Array(n + 1).keys()].map((k) => a + ((b - a) * k) / n);

/**
 * Lower-surface height finder: the y where a vertical ray meets the named skin parts' outer surface from below, or
 * `fallback` if it misses. Only the triangles inside the given box are tested, so a few hundred rays stay cheap.
 */
function skinProbe(ctx, names, { x0, x1, yMax, zMax }) {
  ctx.attitude.updateMatrixWorld(true);
  const pos = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const name of names) {
    const part = ctx.A.parts.find((p) => p.name === name);
    part?.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
      for (let k = 0; k < n; k += 3) {
        const i0 = I ? I.getX(k) : k, i1 = I ? I.getX(k + 1) : k + 1, i2 = I ? I.getX(k + 2) : k + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(P, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(o.matrixWorld);
        if (Math.max(a.x, b.x, c.x) < x0 || Math.min(a.x, b.x, c.x) > x1 || Math.min(a.y, b.y, c.y) > yMax || Math.min(Math.abs(a.z), Math.abs(b.z), Math.abs(c.z)) > zMax) continue;
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const target = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3();
  rc.far = 1.0;
  return (x, z, fallback) => {
    rc.set(o.set(x, fallback - 0.5, z), up);
    const hit = rc.intersectObject(target, false)[0];
    return hit && Math.abs(hit.point.y - fallback) < 0.05 ? hit.point.y : fallback;
  };
}

export function buildAccess(ctx) {
  const { P } = ctx;

  // forward avionics-bay doors: one long door each side on the sloping lower forward fuselage, from the nose to the
  // inlet lips (T.O. 00-105E-9 bottom panel map: actuated panels #4135 left and #4165 right, ≈ s 2.72–5.30, plan
  // |z| ≈ 0.21–0.70, notched in front round the #4134 / #4164 panels, stepped out beside the nose-gear doors and raked
  // at the back)
  {
    const g = [];
    const NW = FR.NOSE_WELL, D = { s0: 2.72, notch: 0.12, sA: 5.30, sR: 4.97, zIn: 0.21, zInAft: NW.z + 0.07, zOut: 0.70 };
    // (outboard of the well's side walls from just ahead of its front wall)
    const j0 = NW.front - 0.14, j1 = NW.front - 0.02;
    const zi = (s) => (s <= j0 ? D.zIn : s >= j1 ? D.zInAft : lerp(D.zIn, D.zInAft, (s - j0) / (j1 - j0)));
    const zAft = (u) => lerp(D.zInAft, D.zOut, u);
    const sF = (u) => D.s0 + D.notch * (1 - Math.abs(2 * u - 1));
    const sB = (u) => D.sA - ((D.sA - D.sR) * Math.max(0, zAft(u) - (D.zInAft + 0.04))) / (D.zOut - D.zInAft - 0.04);
    // the lower forward fuselage between the nose and the inlet lips blends from its V section into the inlets' box
    // section point by point (FR.ringA), so the door follows the ring itself rather than FR.bottomAt
    const lowerRing = (s) => {
      const r = FR.ringA(s), h = r.pts.slice(0, r.half);
      let m = 0; for (let k = 1; k < h.length; k++) if (h[k][2] >= h[m][2]) m = k;
      return h.slice(m);
    };
    // the skin's quads run point to point between the loft's ring stations, so the door does too
    const sA = loftStationsA();
    const lowerAt = (s, z) => {
      const k = Math.max(0, Math.min(sA.length - 2, sA.findIndex((v) => v > s) - 1));
      const a = sA[k], b = sA[k + 1], t = (s - a) / (b - a), ra = lowerRing(a), rb = lowerRing(b), az = Math.abs(z);
      const lo = ra.map((p, j) => [lerp(p[1], rb[j][1], t), lerp(p[2], rb[j][2], t)]);
      for (let j = 0; j < lo.length - 1; j++) {
        const [y0, z0] = lo[j], [y1, z1] = lo[j + 1];
        if (az <= z0 + 1e-9 && az >= z1 - 1e-9) return z0 - z1 > 1e-9 ? lerp(y1, y0, (az - z1) / (z0 - z1)) : Math.min(y0, y1);
      }
      return FR.bottomAt(s, z);
    };
    // The door is then seated a constant 4 mm outside the skin as actually built: each grid point is dropped onto
    // the skin's triangles by a vertical ray. (Interpolating the rings in s alone leaves the triangulated skin up to a
    // few millimetres off in places, and where the door came within 1 mm of it the two surfaces could fight for depth,
    // which polygon offset does not cure in the ambient-occlusion pass.)
    const onSkin = skinProbe(ctx, ['Radome', 'Forward fuselage skin'], { x0: X(D.sA + 0.1), x1: X(D.s0 - 0.1), yMax: 0.05, zMax: D.zOut + 0.1 });
    const us = range(0, 1, 8), ts = range(0, 1, 30);
    for (const side of [1, -1]) {
      const grid = ts.map((t) => us.map((u) => {
        const s = lerp(sF(u), sB(u), t), zz = side * lerp(zi(s), D.zOut, u);
        return [X(s), onSkin(X(s), zz, lowerAt(s, zz)) - 0.004, zz];
      }));
      g.push(slab(grid, () => [0, 0.018, -side * 0.012], V(0, -1, side * 0.5)));
    }
    P('Forward avionics bay doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors on quick-release latches, J-seals and saw-tooth edges', mass: 16, count: 2,
      explode: [1.2, -1.2, 0],
      desc: 'A long door on each side of the lower forward fuselage, from the nose back to the inlet lips, opens onto the forward avionics racks and, on the left, the battery (T.O. 00-105E-9 panels #4135 and #4165, drawn as actuated, J-sealed panels). The forward fuselage holds the radar, processors and CNI racks, so these are among the most-opened doors on the jet; each is sealed and its edges serrated.',
    }, mesh(merge(g), F.door()));
  }

  // AMAD bay doors on the belly under each accessory drive (T.O. 00-105E-9 bottom panel map: the AMAD screens
  // #4223 / #4224 at ≈ 11.3–11.7, z ≈ ±0.45–0.8), and FADEC panels in the lower walls behind the main-gear wells
  {
    const g = [];
    for (const side of [1, -1]) {
      const A = FR.AMAD;
      const pa = (s, u) => [X(s), -FR.bD(s) - 0.003, side * lerp(A.z - 0.2, A.z + 0.2, u)];
      g.push(slab(toothedGrid(pa, range(A.s0 - 0.06, A.s1 + 0.06, 3), { width: 0.4 }), () => [0, 0.012, 0], V(0, -1, 0)));
      const pt = (s, u) => { const [zz, y] = FR.wallB(s, lerp(0.32, 0.86, u)); return [X(s), y, side * (zz + 0.003)]; };
      g.push(slab(toothedGrid(pt, range(M(14.4), M(15.1), 3), { width: 0.5 }), () => [0, 0.01, -side * 0.02], V(0, -0.3, side)));
    }
    P('AMAD & FADEC access panels', {
      system: 'Skin & fairings', skin: true, material: 'Composite panels, saw-tooth edges', mass: 14, count: 4,
      explode: [0, -0.7, 1.75],
      desc: 'A door in the belly under each airframe-mounted accessory drive (T.O. 00-105E-9 marks the AMAD bay screens there) opens onto the drive with its generator, hydraulic pumps and air-turbine starter; panels in the lower walls further aft reach the FADEC on the engine case. Most F119 line-replaceable units are one deep, so none has to come off to reach another (positions approximate).',
    }, mesh(merge(g), F.door()));
  }

  // engine-bay panels on the upper deck between the fins
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s0, s1] of [[M(13.45), M(14.35)], [M(14.55), M(15.45)]]) {
        const pt = (s, u) => { const zz = side * lerp(0.82, 1.32, u); return [X(s), FR.topAt(s, Math.abs(zz)) + 0.003, zz]; };
        g.push(slab(toothedGrid(pt, range(s0, s1, 3), { width: 0.5 }), () => [0, -0.02, 0], V(0, 1, 0)));
      }
    }
    P('Engine-bay upper access panels', {
      system: 'Skin & fairings', skin: true, material: 'Titanium / high-temperature composite panels, saw-tooth edges', mass: 18, count: 4,
      explode: [-0.4, 1.9, 0],
      desc: 'Upper panels over each engine bay reach the oil tank, fire bottles and engine-bay equipment. Each opened seam has to be resealed and its coating checked afterwards, which is why stealth measures make up almost a third of F-22 maintenance (positions approximate).',
    }, mesh(merge(g), F.door()));
  }
}
