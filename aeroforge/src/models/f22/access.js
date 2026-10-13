// F-22A maintenance access: the flush, saw-tooth-edged panels a crew chief opens most often — the
// forward avionics-bay doors under the chines, the AMAD / FADEC panels on the lower aft fuselage
// walls and the engine-bay panels on the upper deck. Every panel seam is a low-observable maintenance
// item, so the F-22 has far fewer of them than an F-15. Positions are approximate (from photographs).

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, toothedGrid } from './util.js';

const { X, lerp } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const range = (a, b, n) => [...Array(n + 1).keys()].map((k) => a + ((b - a) * k) / n);

export function buildAccess(ctx) {
  const { P } = ctx;

  // forward avionics-bay doors: two per side on the lower forward fuselage, just under the chine
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s0, s1] of [[2.85, 3.5], [3.6, 4.3]]) {
        const pt = (s, u) => {
          const zz = side * lerp(FR.aW(s) - 0.07, FR.aW(s) - 0.44, u);
          return [X(s), FR.bottomAt(s, zz) - 0.003, zz];
        };
        g.push(slab(toothedGrid(pt, range(s0, s1, 3), { width: 0.42 }), () => [0, 0.02, -side * 0.015], V(0, -1, side * 0.5)));
      }
    }
    P('Forward avionics bay doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors on quick-release latches, saw-tooth fore and aft edges', mass: 16, count: 4,
      explode: [1.2, -1.2, 0],
      desc: 'Hinged doors under each chine open onto the forward avionics racks for line-replaceable-unit changes. The forward fuselage holds the radar, processors and CNI racks, so these are among the most-opened doors on the jet; each is sealed and its edges serrated (positions approximate).',
    }, mesh(merge(g), F.door()));
  }

  // AMAD and FADEC access on the lower walls of the aft fuselage
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s0, s1] of [[13.3, 14.2], [14.4, 15.1]]) {
        const pt = (s, u) => { const [zz, y] = FR.wallB(s, lerp(0.32, 0.86, u)); return [X(s), y, side * (zz + 0.003)]; };
        g.push(slab(toothedGrid(pt, range(s0, s1, 3), { width: 0.5 }), () => [0, 0.01, -side * 0.02], V(0, -0.3, side)));
      }
    }
    P('AMAD & FADEC access panels', {
      system: 'Skin & fairings', skin: true, material: 'Composite panels, saw-tooth edges', mass: 14, count: 4,
      explode: [0, -0.7, 1.75],
      desc: 'Panels in the lower walls of the aft fuselage open onto each airframe-mounted accessory drive with its generator and hydraulic pumps, and onto the FADEC on the engine case; most F119 line-replaceable units are one deep, so none has to come off to reach another (positions approximate).',
    }, mesh(merge(g), F.door()));
  }

  // engine-bay panels on the upper deck between the fins
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s0, s1] of [[13.45, 14.35], [14.55, 15.45]]) {
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
