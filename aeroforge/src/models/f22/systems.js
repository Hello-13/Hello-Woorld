// F-22A internal systems: fuel (fuselage and wing tanks, lines, refuelling receptacle, vent /
// dump), hydraulics (two independent 4,000 psi systems), electrical (270 V DC generation, APU and
// stored-energy system, batteries, distribution), environmental control and thermal management,
// avionics and sensors (AN/APG-77, CIPs, CNI, ALR-94, AAR-56, air data), lighting and antennas.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { M } from '../../engine/materials.js';
import { naca00, mirrorZ } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge } from './util.js';

const { X, mono, lerp } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);

const ductCols = [1, 2, 3, 4, 5].map((c) => FR.DUCT.map((r) => [r[0], r[c]]));
/** Inlet duct centre, size at station s (right side). */
function ductAt(s) { const [zc, yc, w, h] = ductCols.map((k) => mono(k, s)); return { zc, yc, w, h }; }
function ductTop(s, z) {
  const { zc, yc, w, h } = ductAt(s);
  const u = Math.abs(z - zc) / (w / 2);
  if (u >= 1) return yc;
  return yc + (h / 2) * Math.pow(1 - Math.pow(u, 3), 1 / 3);
}

/** Closed tank loft from a list of [z, y] right-half outlines (top centre → … → bottom centre). */
function tankLoft(st, outline) {
  const rings = st.map((s) => {
    const half = outline(s);
    const left = half.slice(1, -1).reverse().map(([z, y]) => [-z, y]);
    return half.concat(left).map(([z, y]) => [X(s), y, z]);
  });
  const g = FR.gridSurface(rings, { closed: true, uv: 'n' });
  const caps = [rings[0], rings[rings.length - 1]].map((r) => {
    const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length, a[2] + p[2] / r.length], [0, 0, 0]);
    const pos = [...c], idx = [];
    for (const p of r) pos.push(...p);
    for (let k = 0; k < r.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % r.length));
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    return cg;
  });
  // volume from the cross-section areas
  let vol = 0;
  for (let i = 0; i < st.length - 1; i++) {
    const area = (s) => { const h = outline(s); let a = 0; for (let k = 0; k < h.length - 1; k++) a += (h[k][0] * h[k + 1][1] - h[k + 1][0] * h[k][1]); return Math.abs(a); };
    vol += ((area(st[i]) + area(st[i + 1])) / 2) * (st[i + 1] - st[i]);
  }
  return { geo: merge([g, ...caps]), vol };
}

const range = (a, b, n) => [...Array(n + 1).keys()].map((k) => a + ((b - a) * k) / n);

/** "Saddle" tank cross-section over / between the inlet ducts. */
function saddle(s, { ybot, zo = 1.45, gapTop = 0.07 }) {
  const { zc, w } = ductAt(s);
  const zi = Math.max(0.08, zc - w / 2 - 0.05);
  const zO = Math.min(zo, zc + w / 2 - 0.12, FR.bW(Math.max(s, FR.S_AB)) - 0.45);
  const top = (z) => FR.topAt(s, z) - gapTop;
  const over = (z) => Math.min(ductTop(s, z) + 0.05, top(z) - 0.03);
  const half = [];
  for (const z of range(0, zO, 7)) half.push([z, top(z)]);
  for (const z of range(zO, zi, 5)) half.push([z, over(z)]);
  half.push([zi, ybot]);
  half.push([0, ybot]);
  return half;
}

export function buildSystems(ctx) {
  const { P, anim } = ctx;
  const tanks = [];

  // ================================================================== fuel
  const st1 = range(7.08, 8.35, 6);
  const t1 = tankLoft(st1, (s) => {
    const zA = FR.aW(s) - 0.1;
    const half = range(0, zA, 6).map((z) => [z, FR.topAt(s, z) - 0.07]);
    half.push([zA, -0.45], [0, -0.45]);
    return half;
  });
  const st2 = range(8.5, 12.3, 12);
  const t2 = tankLoft(st2, (s) => saddle(s, { ybot: -0.2 }));
  const st3 = range(12.45, 13.25, 4);
  const t3 = tankLoft(st3, (s) => saddle(s, { ybot: -0.38, zo: 1.35 }));
  // wing tanks between the front and rear spars, inboard ~70 % of the span
  const wingTank = () => {
    const zs = range(1.92, 5.35, 6);
    const fs = range(0.11, 0.74, 7);
    const rings = zs.map((z) => {
      const sec = FR.wingSection(z);
      const pts = [];
      for (const f of fs) pts.push([sec.le[0] - f * sec.chord, sec.le[1] + naca00(f, sec.t) * sec.chord * 0.84, z]);
      for (const f of [...fs].reverse()) pts.push([sec.le[0] - f * sec.chord, sec.le[1] - naca00(f, sec.t) * sec.chord * 0.84, z]);
      return pts;
    });
    let vol = 0;
    for (let i = 0; i < zs.length - 1; i++) {
      const area = (z) => { const sec = FR.wingSection(z); let a = 0; for (let k = 0; k < fs.length - 1; k++) a += (fs[k + 1] - fs[k]) * sec.chord * 2 * naca00((fs[k] + fs[k + 1]) / 2, sec.t) * sec.chord * 0.84; return a; };
      vol += ((area(zs[i]) + area(zs[i + 1])) / 2) * (zs[i + 1] - zs[i]);
    }
    const g = FR.gridSurface(rings, { closed: true, uv: 'n' });
    return { geo: g, vol };
  };
  const tw = wingTank();
  // scale the modelled volumes so the total matches the published 18,000 lb (8,200 kg) internal fuel
  const vols = [t1.vol, t2.vol, t3.vol, tw.vol, tw.vol];
  const total = vols.reduce((a, b) => a + b, 0);
  const kg = vols.map((v) => Math.round((v / total) * 8200 / 10) * 10);
  const L = (k) => Math.round(k / 0.8 / 10) * 10;
  ctx.fuel = { kg, vols };
  const fuelMat = F.tank();
  tanks.push(P('Forward fuselage tank (F-1)', {
    system: 'Fuel', material: 'Integral tank in the fuselage structure, foam-free, nitrogen inerted', mass: kg[0],
    explode: [0.6, 1.9, 0],
    desc: `Behind the cockpit bulkhead, above the nose-gear area. Modelled capacity ≈ ${kg[0].toLocaleString('en-US')} kg (${L(kg[0]).toLocaleString('en-US')} L) of JP-8 — tank sizes are estimates scaled so all tanks hold the published 8,200 kg; mass shown is the fuel.`,
  }, mesh(t1.geo, fuelMat)));
  tanks.push(P('Centre fuselage tank (F-2)', {
    system: 'Fuel', material: 'Integral tank wrapped over the inlet ducts and weapons bay', mass: kg[1],
    explode: [0, 2.15, 0], callout: false,
    desc: `The largest tank, saddled over both inlet ducts and the main weapons bay. Modelled capacity ≈ ${kg[1].toLocaleString('en-US')} kg (${L(kg[1]).toLocaleString('en-US')} L, estimate). Fuel is also the jet's main heat sink: avionics heat is dumped into it.`,
  }, mesh(t2.geo, fuelMat)));
  tanks.push(P('Aft fuselage feed tank (F-3)', {
    system: 'Fuel', material: 'Integral tank with boost pumps', mass: kg[2],
    explode: [-0.3, 2.0, 0],
    desc: `Just ahead of the engines. Boost pumps here keep both engines fed in any attitude, including inverted and high-g flight. Modelled capacity ≈ ${kg[2].toLocaleString('en-US')} kg (estimate).`,
  }, mesh(t3.geo, fuelMat)));
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    tanks.push(P(`Wing tank (${R})`, {
      system: 'Fuel', material: 'Integral (wet) wing box, sealed', mass: kg[3],
      explode: [0, 0.8, 2.55 * side],
      desc: `The wing box itself is the tank, between the front and rear spars. Modelled capacity ≈ ${kg[3].toLocaleString('en-US')} kg (estimate). Two 2,270 L drop tanks can be added for ferry flights, at the cost of stealth.`,
    }, mesh(side > 0 ? tw.geo : mirrorZ(tw.geo), fuelMat)));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      g.push(FR.pipe([[11.4, -0.05, side * 2.2], [11.6, -0.12, side * 1.7], [11.9, -0.18, side * 0.7], [12.6, -0.3, side * 0.3]], 0.03, 6));
      g.push(FR.pipe([[12.9, -0.3, side * 0.25], [13.2, -0.4, side * 0.45], [13.5, -0.5, side * 0.65], [13.7, -0.55, side * 0.75]], 0.03, 6));
      g.push(FR.pipe([[8.4, 0.1, side * 0.3], [10.5, -0.1, side * 0.25], [12.6, -0.25, side * 0.22]], 0.025, 6));
    }
    g.push(FR.pipe([[7.5, 0.2, 0], [8.5, 0.15, 0.15], [10, 0.1, 0.15]], 0.025, 6));
    P('Fuel feed & transfer lines', {
      system: 'Fuel', material: 'Aluminium / titanium tubing', mass: 60,
      explode: [0, 1.25, 0],
      desc: 'Transfer pumps move fuel from the wing and fuselage tanks to the feed tank to keep the centre of gravity in place; feed lines run from there to each engine\'s fuel pump. Refuelling flow from the receptacle runs forward to aft.',
    }, mesh(merge(g), F.pipe()));
  }
  {
    // dorsal air-refuelling receptacle: slipway trough with the nozzle socket at its aft end
    const g = [];
    const s0 = 7.75, s1 = 8.3;
    const prof = (s) => [[0.15, FR.topAt(s, 0.15) - 0.01], [0.12, FR.topAt(s, 0) - 0.24], [-0.12, FR.topAt(s, 0) - 0.24], [-0.15, FR.topAt(s, 0.15) - 0.01]].map(([z, y]) => [X(s), y, z]);
    g.push(FR.gridSurface([prof(s0), prof((s0 + s1) / 2), prof(s1)], { closed: false, uv: 'n' }));
    g.push(FR.cylX(8.22, FR.topAt(8.22, 0) - 0.17, 0, 0.12, 0.05, 0.08, 14));
    P('Air-refuelling receptacle', {
      system: 'Fuel', material: 'Aluminium slipway and receptacle', mass: 25,
      explode: [0.2, 2.7, 0],
      desc: 'A USAF flying-boom receptacle on the spine behind the canopy. A tanker\'s boom plugs in here; at full rate it can refill the internal tanks in a few minutes.',
    }, mesh(merge(g), F.yellow()));
    const grid = [];
    for (const s of [s0, (s0 + s1) / 2, s1]) grid.push([-0.15, -0.05, 0.05, 0.15].map((z) => [X(s), FR.topAt(s, z) + 0.003, z]));
    const dm = F.skin().clone();
    dm.polygonOffset = true; dm.polygonOffsetFactor = -2; dm.polygonOffsetUnits = -2;
    const door = slab(grid, () => [0, -0.02, 0], V(0, 1, 0));
    const h = hinge(mesh(door, dm), V(X(s1), FR.topAt(s1, 0.15), -0.15), V(X(s1), FR.topAt(s1, 0.15), 0.15), V(X(s0), 0.7, 0), V(0, -1, 0));
    P('Air-refuelling door', {
      system: 'Skin & fairings', skin: true, material: 'Composite door', mass: 6,
      explode: [0.2, 3.2, 0],
      desc: 'Rotates down into the spine to expose the receptacle and its lights, and closes flush afterwards.',
    }, h.pivot);
    anim.arDoor = h;
  }
  P('Fuel vent & dump system', {
    system: 'Fuel', material: 'Titanium vent lines, dump mast between the nozzles', mass: 18,
    explode: [-1.0, -0.2, 0],
    desc: 'Vent lines keep tank pressure in limits as fuel is used and altitude changes; a dump line exits between the nozzles so fuel can be jettisoned to reach a safe landing weight.',
  }, mesh(merge([FR.pipe([[12.9, 0.2, 0.1], [14.5, 0.3, 0.1], [16.5, 0.25, 0.08], [17.6, -0.05, 0.0], [18.05, -0.08, 0.0]], 0.025, 6), FR.cylX(18.08, -0.08, 0, 0.12, 0.035, 0.03, 10)]), F.pipe()));

  // ================================================================== hydraulics
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const g = [];
    for (const dy of [0.0, 0.14]) g.push(FR.cylX(14.22, -0.47 + dy, side * 1.38, 0.32, 0.06, 0.055, 14));
    g.push(box(14.05, -0.4, side * 1.38, 0.06, 0.3, 0.16));
    P(`Hydraulic pumps (${R} AMAD)`, {
      system: 'Hydraulics', material: 'Variable-displacement piston pumps', mass: 32, count: 2,
      explode: [-0.1, -1.0, 1.0 * side],
      desc: `Two engine-driven pumps on the ${R} accessory drive pressurise ${side > 0 ? 'system A' : 'system B'} at 4,000 psi (27.6 MPa) — higher than the usual 3,000 psi, so actuators and lines can be smaller and lighter.`,
    }, mesh(merge(g), F.hyd()));
  }
  P('Hydraulic reservoirs (A & B)', {
    system: 'Hydraulics', material: 'Bootstrap reservoirs', mass: 30, count: 2,
    explode: [0, -1.2, 0],
    desc: 'Each of the two independent systems has its own pressurised reservoir, so a leak in one cannot drain the other; every flight-control actuator is fed by both.',
  }, mesh(merge([FR.cylX(13.0, -0.62, 0.5, 0.42, 0.09, 0.09, 14), FR.cylX(13.0, -0.62, -0.5, 0.42, 0.09, 0.09, 14)]), F.hyd()));
  P('Hydraulic accumulators', {
    system: 'Hydraulics', material: 'Nitrogen-charged steel accumulators', mass: 24, count: 3,
    explode: [0, -1.35, 0.3],
    desc: 'Gas-charged accumulators store pressurised fluid to smooth pump ripple, back up the wheel brakes and give an emergency stroke for critical actuators.',
  }, mesh(merge([new THREE.SphereGeometry(0.09, 14, 10).translate(X(12.75), -0.62, 0.17), new THREE.SphereGeometry(0.09, 14, 10).translate(X(12.75), -0.62, -0.17), new THREE.CapsuleGeometry(0.06, 0.18, 4, 10).rotateZ(Math.PI / 2).translate(X(12.5), -0.66, 0)]), F.steel()));
  {
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      g.push(FR.pipe([[14.2, -0.42, z * 1.38], [13.6, -0.5, z * 1.0], [12.6, -0.7, z * 0.84], [10.5, -0.74, z * 0.84], [8.5, -0.7, z * 0.84], [6.0, -0.5, z * 0.6], [4.4, -0.32, z * 0.2]], 0.016, 5, 60));
      g.push(FR.pipe([[14.2, -0.42, z * 1.38], [15.5, -0.35, z * 1.4], [16.4, -0.26, z * 1.38]], 0.016, 5));
      g.push(FR.pipe([[14.6, -0.35, z * 1.4], [14.6, 0.25, z * 1.42], [14.9, 0.4, z * 1.45]], 0.014, 5));
      g.push(FR.pipe([[13.2, -0.55, z * 1.0], [13.4, -0.15, z * 1.6], [13.6, -0.1, z * 2.6], [13.9, -0.15, z * 4.2]], 0.014, 5));
      g.push(FR.pipe([[11.0, -0.72, z * 0.84], [11.3, -0.6, z * 1.2]], 0.014, 5));
    }
    P('Hydraulic lines (A & B)', {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi)', mass: 70,
      explode: [0, -0.55, 0],
      desc: 'Two separate line runs, one per system, take pressure to the flight-control actuators, the landing gear, nose-wheel steering, brakes, and the weapons-bay doors and launchers.',
    }, mesh(merge(g), F.hyd()));
  }

  // ================================================================== electrical
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    P(`Generator (${R})`, {
      system: 'Electrical', material: 'Brushless 270 V DC generator, oil cooled', mass: 40,
      explode: [0.45, -1.05, 1.05 * side],
      desc: 'Driven by the accessory drive, it supplies the 270 V DC primary bus. A high-voltage DC system saves copper weight; development-era figures give about 157 kW of primary and auxiliary electrical power in total.',
    }, mesh(merge([FR.cylX(13.36, -0.42, side * 1.38, 0.26, 0.1, 0.1, 18), box(13.2, -0.42, side * 1.38, 0.06, 0.16, 0.16)]), F.yellow()));
  }
  P('Auxiliary power unit (APU)', {
    system: 'Electrical', material: 'Small gas turbine, 335 kW (450 hp) class', mass: 75,
    explode: [0.2, -1.65, 0],
    desc: 'Part of the auxiliary power generation system (AlliedSignal, now Honeywell): it starts the engines without ground carts and can restart them in flight below about 12,500 m. Location in the lower fuselage is approximate.',
  }, mesh(merge([FR.cylX(13.75, -0.5, 0, 0.55, 0.14, 0.12, 18), FR.pipe([[14.0, -0.5, 0], [14.15, -0.62, 0], [14.2, -0.78, 0]], 0.05, 8)]), F.boxLight()));
  P('Stored-energy system', {
    system: 'Electrical', material: 'High-pressure gas bottle and turbine', mass: 30,
    explode: [0.5, -1.85, 0.2],
    desc: 'An emergency power source that comes on line within 5 s at any altitude, airspeed or attitude to keep the flight controls, hydraulics and essential electrics alive if both engines fail (about 75 kW).',
  }, mesh(merge([new THREE.CapsuleGeometry(0.1, 0.3, 4, 12).rotateZ(Math.PI / 2).translate(X(12.95), -0.73, 0.18)]), F.orange()));
  P('Batteries', {
    system: 'Electrical', material: 'Main and APU-start batteries', mass: 40, count: 2,
    explode: [0.4, -0.9, -0.6],
    desc: 'Batteries power the APU start and hold essential systems for a short time if all generation is lost.',
  }, mesh(merge([box(6.5, -0.55, 0.5, 0.3, 0.16, 0.22), box(6.5, -0.55, -0.5, 0.3, 0.16, 0.22)]), F.box()));
  {
    const g = [box(5.6, -0.28, 0.72, 0.6, 0.26, 0.14), box(5.6, -0.28, -0.72, 0.6, 0.26, 0.14)];
    g.push(FR.pipe([[3.0, -0.35, 0.3], [5.0, -0.42, 0.62], [7.5, -0.5, 0.75], [10.5, -0.2, 0.55], [13.0, 0.45, 0.6], [16.5, 0.4, 1.2]], 0.025, 6));
    g.push(FR.pipe([[3.0, -0.35, -0.3], [5.0, -0.42, -0.62], [7.5, -0.5, -0.75], [10.5, -0.2, -0.55], [13.0, 0.45, -0.6], [16.5, 0.4, -1.2]], 0.025, 6));
    P('Power distribution (270 V DC)', {
      system: 'Electrical', material: 'Solid-state power controllers, wiring harnesses', mass: 160,
      explode: [0.5, -0.65, 0],
      desc: 'Power distribution centres switch and protect the 270 V DC buses and convert power for 28 V DC and AC loads; harnesses run the length of the jet.',
    }, mesh(merge(g), F.box()));
  }

  // ================================================================== environmental control & thermal management
  P('Environmental control system', {
    system: 'Environmental control', material: 'Air-cycle machine, water separator', mass: 110,
    explode: [0.4, -1.1, 0],
    desc: 'Engine bleed air is cooled through heat exchangers and an air-cycle machine to pressurise and air-condition the cockpit and cool equipment (layout and position approximate).',
  }, mesh(merge([FR.cylX(6.45, -0.45, 0, 0.36, 0.13, 0.11, 18), box(6.05, -0.42, 0.22, 0.32, 0.26, 0.24), box(6.05, -0.42, -0.22, 0.32, 0.26, 0.24)]), F.boxLight()));
  P('Fuel–PAO heat exchangers', {
    system: 'Environmental control', material: 'Aluminium plate-fin cores', mass: 45, count: 2,
    explode: [0.4, -1.35, 0.4],
    desc: 'Heat from the avionics is carried by liquid coolant and dumped into the fuel, which then burns in the engines. Thermal management is a big limit on a stealthy jet that cannot have many external cooling scoops.',
  }, mesh(merge([box(7.35, -0.62, 0.35, 0.34, 0.2, 0.3), box(7.35, -0.62, -0.35, 0.34, 0.2, 0.3)]), F.copper()));
  P('PAO liquid-cooling loop', {
    system: 'Environmental control', material: 'Polyalphaolefin coolant in aluminium lines', mass: 55,
    explode: [0.8, -0.25, 0],
    desc: 'A liquid loop of PAO coolant runs through cold plates under the radar\'s transmit/receive modules and the integrated processors, then back to the fuel–PAO heat exchangers.',
  }, mesh(merge([
    FR.pipe([[2.62, 0.0, 0.42], [2.9, -0.3, 0.45], [4.5, -0.45, 0.55], [7.2, -0.6, 0.4]], 0.02, 6),
    FR.pipe([[2.62, 0.0, -0.42], [2.9, -0.3, -0.45], [4.5, -0.45, -0.55], [7.2, -0.6, -0.4]], 0.02, 6),
    FR.pipe([[3.0, 0.35, 0.3], [3.4, 0.4, 0.0], [3.0, 0.35, -0.3]], 0.016, 6),
  ]), F.ductDark()));
  P('OBOGS oxygen concentrator', {
    system: 'Environmental control', material: 'Molecular-sieve oxygen concentrator', mass: 18,
    explode: [0.2, 1.05, -0.6],
    desc: 'The on-board oxygen generation system strips nitrogen from engine bleed air to give the pilot breathing oxygen without liquid-oxygen servicing.',
  }, mesh(box(6.6, 0.12, -0.42, 0.24, 0.22, 0.16), F.boxLight()));

  // ================================================================== avionics
  P('Common integrated processors', {
    system: 'Avionics', material: 'Liquid-cooled modular processor racks', mass: 120, count: 2,
    explode: [1.9, 1.2, 0],
    desc: 'Two liquid-cooled processor racks (with space for a third) run the radar, EW, CNI and fusion software. Sensor fusion merges every sensor\'s tracks into one picture before the pilot sees it.',
  }, mesh(merge([box(3.0, 0.12, 0.27, 0.6, 0.34, 0.3), box(3.0, 0.12, -0.27, 0.6, 0.34, 0.3)]), F.box()));
  P('CNI suite', {
    system: 'Avionics', material: 'Integrated comm / nav / identification modules', mass: 70,
    explode: [2.1, -0.75, 0],
    desc: 'Communication, navigation and identification functions (radios, IFF, TACAN, landing aids) share common modules rather than separate boxes for each radio.',
  }, mesh(merge([box(3.05, -0.25, 0.2, 0.7, 0.18, 0.32), box(3.05, -0.25, -0.2, 0.7, 0.18, 0.32)]), F.boxLight()));
  P('Intra-flight data link', {
    system: 'Avionics', material: 'Low-probability-of-intercept data link', mass: 15,
    explode: [0.6, 0.6, 1.1],
    desc: 'IFDL shares sensor tracks silently between F-22s in a flight using narrow, hard-to-detect transmissions.',
  }, mesh(merge([box(5.0, -0.22, 0.72, 0.4, 0.2, 0.12)]), F.box()));
  P('Inertial navigation & GPS', {
    system: 'Avionics', material: 'Ring-laser-gyro inertial reference with embedded GPS', mass: 18,
    explode: [2.0, 1.75, 0],
    desc: 'Measures the jet\'s attitude, velocity and position, corrected by GPS, for navigation, weapons and the flight controls.',
  }, mesh(box(3.45, 0.18, 0, 0.18, 0.18, 0.22), F.box()));
  P('Vehicle management system computers', {
    system: 'Flight controls', material: 'Redundant flight-control processors', mass: 25, count: 3,
    explode: [2.2, 1.95, 0.6],
    desc: 'Fly-by-wire computers turn stick and throttle inputs into surface and nozzle commands many times a second. The airframe is unstable in pitch for agility, so they never stop correcting (channel count illustrative).',
  }, mesh(merge([box(3.45, 0.06, 0.3, 0.16, 0.24, 0.12), box(3.45, 0.06, -0.3, 0.16, 0.24, 0.12), box(3.45, -0.14, 0, 0.16, 0.14, 0.2)]), F.boxLight()));

  // ================================================================== AN/APG-77 radar
  {
    const tilt = 20 * FR.DEG;
    const face = new THREE.CircleGeometry(1, 48).scale(0.47, 0.33, 1).rotateY(Math.PI / 2).rotateZ(-tilt).translate(X(2.42), -0.02, 0);
    const back = new THREE.CylinderGeometry(1, 1, 0.06, 48).rotateX(Math.PI / 2).scale(0.47, 0.33, 1).rotateY(Math.PI / 2).rotateZ(-tilt).translate(X(2.46), -0.02, 0);
    // tile rows: thin strips that read as the subarrays of transmit/receive modules
    const rows = [];
    for (let k = -6; k <= 6; k++) {
      const yy = k * 0.05;
      const half = 0.47 * Math.sqrt(Math.max(0, 1 - (yy / 0.33) ** 2));
      if (half < 0.05) continue;
      rows.push(new THREE.BoxGeometry(0.004, 0.006, half * 2).translate(0, yy, 0));
    }
    const grid = merge(rows).rotateZ(-tilt).translate(X(2.415), -0.02, 0);
    const array = P('AN/APG-77 AESA array', {
      system: 'Sensors', material: 'Gallium-arsenide transmit/receive modules on a cooled backplane', mass: 220,
      explode: [2.5, 0.35, 0], callout: true, anchor: [X(2.4), 0.3, 0],
      desc: 'About 1,956 thumb-sized transmit/receive modules (the most cited figure; sources range ~1,900–2,000) steer the beam electronically in microseconds with no moving antenna. The fixed array is tilted back so it never squares up to another radar.',
    }, [mesh(face, F.array()), mesh(back, F.alu()), mesh(grid, F.tile(), { cast: false })]);
    void array;
    const m = [];
    for (const [a, b] of [[[2.48, 0.25, 0.3], [2.58, 0.2, 0.3]], [[2.48, 0.25, -0.3], [2.58, 0.2, -0.3]], [[2.44, -0.3, 0.3], [2.58, -0.3, 0.3]], [[2.44, -0.3, -0.3], [2.58, -0.3, -0.3]]]) m.push(FR.pipe([a, b], 0.03, 6, 2));
    m.push(new THREE.TorusGeometry(1, 0.03, 6, 48).scale(0.42, 0.29, 1).rotateY(Math.PI / 2).rotateZ(-tilt).translate(X(2.5), -0.02, 0));
    P('APG-77 array mount & coolant manifold', {
      system: 'Sensors', material: 'Aluminium mount, PAO manifold', mass: 40,
      explode: [2.0, 0.35, 0],
      desc: 'Holds the array at its fixed tilt on the radar bulkhead and feeds liquid coolant to the cold plates behind the modules — an AESA turns much of its power into heat.',
    }, mesh(merge(m), F.alu()));
    P('APG-77 receiver / exciter & power supply', {
      system: 'Sensors', material: 'Radar receiver, exciter and power-supply modules', mass: 60,
      explode: [1.6, 0.85, 0],
      desc: 'Generates the radar waveforms and digitises the returns; the signal processing itself runs in the common integrated processors.',
    }, mesh(merge([box(2.68, 0.25, 0, 0.18, 0.16, 0.6), box(2.68, -0.25, 0, 0.18, 0.12, 0.5)]), F.boxLight()));
  }

  // ================================================================== distributed sensors
  {
    const g = [];
    const patch = (p, n, w = 0.12, h = 0.05) => {
      const geo = new THREE.BoxGeometry(w, 0.008, h);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
      geo.translate(p.x, p.y, p.z);
      g.push(geo);
    };
    for (const side of [1, -1]) {
      for (const eta of [0.2, 0.45, 0.7, 0.92]) {
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        patch(V(sec.le[0] - 0.02 * sec.chord, sec.le[1] + naca00(0.02, sec.t) * sec.chord + 0.002, side * z), V(0.2, 1, 0), 0.1, 0.16);
      }
      for (const eta of [0.35, 0.8]) {
        const z = 1.45 + eta * (FR.WING.semi - 1.45);
        const sec = FR.wingSection(z);
        patch(V(sec.le[0] - 0.9 * sec.chord, sec.le[1] + 0.012, side * z), V(0, 1, 0), 0.08, 0.14);
      }
      for (const s of [1.8, 2.3, 4.0]) patch(V(X(s), FR.aYC(s) + 0.05, side * (FR.aW(s) - 0.05)), V(0, 1, side * 0.6));
      for (const s of [16.2, 17.0]) patch(V(X(s), FR.topAt(s, 1.4) + 0.004, side * 1.4), V(0, 1, side * 0.3));
      patch(V(X(17.2), -FR.bD(17.2) - 0.004, side * 1.0), V(0, -1, 0));
    }
    P('AN/ALR-94 EW apertures', {
      system: 'Sensors', material: 'Conformal broadband antennas', mass: 30, count: 30,
      explode: [0, 0.3, 0],
      desc: 'A passive receiver system of more than 30 antennas blended into the wings and fuselage. It detects, identifies and locates radar emitters well beyond their own detection range, often cueing the APG-77 (antenna positions illustrative).',
    }, mesh(merge(g), F.composite()));
  }
  {
    const g = [];
    const eye = (p, n) => {
      const geo = new THREE.CylinderGeometry(0.055, 0.06, 0.02, 18);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n.clone().normalize()));
      geo.translate(p.x, p.y, p.z);
      g.push(geo);
    };
    for (const side of [1, -1]) {
      eye(V(X(3.2), FR.upperA(3.2, 0.45) + 0.004, side * 0.45), V(0, 1, side * 0.9));
      eye(V(X(3.4), FR.bottomAt(3.4, 0.35) - 0.004, side * 0.35), V(0, -1, side * 0.6));
      eye(V(X(16.8), -FR.bD(16.8) * 0.6, side * (FR.bW(16.8) - 0.05)), V(0, -0.3, side));
    }
    P('AN/AAR-56 missile launch detectors', {
      system: 'Sensors', material: 'Infrared sensor windows', mass: 18, count: 6,
      explode: [0, 0.3, 0.4],
      desc: 'Six infrared sensors give all-round coverage to warn of a missile launch and cue countermeasures (window positions approximate).',
    }, mesh(merge(g), F.lens()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      for (const [s, dy] of [[2.05, -0.05], [2.5, 0.06]]) {
        const z = FR.aW(s) - 0.02;
        const y = FR.aYC(s) + dy;
        g.push(FR.pipe([[s, y, side * z], [s - 0.02, y, side * (z + 0.07)]], 0.008, 6, 2));
        g.push(FR.cylX(s - 0.1, y, side * (z + 0.07), 0.2, 0.006, 0.008, 6));
      }
    }
    P('Air-data probes', {
      system: 'Sensors', material: 'Heated multi-function pitot-static probes', mass: 6, count: 4,
      explode: [1.6, 0, 0.45],
      desc: 'Small L-shaped probes on the sides of the nose measure total and static pressure and flow angle for the flight controls and air-data computers; they are electrically heated against ice (count approximate).',
    }, mesh(merge(g), F.probe()));
  }

  // ================================================================== lighting and antennas
  {
    const red = [], green = [], white = [], form = [];
    for (const { side, le, chord } of ctx.wingTips) {
      const lens = new THREE.SphereGeometry(0.045, 12, 8).scale(1.6, 0.6, 0.6).translate(le.x - 0.15 * chord, le.y, le.z + side * 0.005);
      (side > 0 ? green : red).push(lens);
      form.push(new THREE.BoxGeometry(0.5, 0.006, 0.05).translate(le.x - 0.55 * chord, le.y + 0.03, le.z - side * 0.15));
    }
    for (const side of [1, -1]) form.push(new THREE.BoxGeometry(0.6, 0.006, 0.05).rotateX(side * 0.5).translate(X(4.6), FR.aYC(4.6) + 0.05, side * (FR.aW(4.6) - 0.06)));
    white.push(new THREE.SphereGeometry(0.035, 10, 8).translate(X(18.62), -0.08, -1.52));
    const navG = mesh(merge(green), M.navGreen(), { cast: false });
    const navR = mesh(merge(red), M.navRed(), { cast: false });
    const navW = mesh(merge(white), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 2.5 }), { cast: false });
    const strips = mesh(merge(form), M.formation(), { cast: false });
    P('Navigation & formation lights', {
      system: 'Electrical', material: 'LED position lights, electroluminescent formation strips', mass: 5,
      explode: [0, 0.6, 0],
      desc: 'Red and green position lights at the wing tips and a white tail light; low-intensity electroluminescent strips on the chines, wing tips and fins let a wingman hold formation at night without showing far.',
    }, [navG, navR, navW, strips]);
    const stMat = M.strobe().clone();
    const s1 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(16.9), FR.topAt(16.9, 0) + 0.02, 0);
    const s2 = new THREE.SphereGeometry(0.04, 12, 8).scale(1.4, 0.7, 1).translate(X(12.8), -FR.bD(12.8) - 0.02, 0);
    P('Anti-collision strobes', {
      system: 'Electrical', material: 'White LED strobes', mass: 2, count: 2,
      explode: [-0.4, 0.9, 0],
      desc: 'White anti-collision strobes on the spine and belly (positions approximate). They flash about once a second in flight and stay off on the ground.',
    }, mesh(merge([s1, s2]), stMat, { cast: false }));
    anim.strobe = stMat;
    // blade and flush antennas
    const blade = (s, y, up, h, c) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(c, 0); sh.lineTo(c * 0.62, h); sh.lineTo(c * 0.3, h); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false });
      g.translate(-c / 2, 0, -0.008);
      g.rotateY(Math.PI);
      if (up < 0) g.rotateX(Math.PI);
      return g.translate(X(s), y, 0);
    };
    const ant = [blade(9.9, FR.topAt(9.9, 0) - 0.01, 1, 0.13, 0.26), blade(6.2, FR.bottomAt(6.2, 0) + 0.01, -1, 0.12, 0.22)];
    ant.push(box(10.8, FR.topAt(10.8, 0) + 0.002, 0, 0.14, 0.006, 0.14));
    P('Communication antennas', {
      system: 'Communications', material: 'Composite blade and flush patch antennas', mass: 8, count: 3,
      explode: [0, 0.85, 0],
      desc: 'Only a few small blades break the outline: UHF/VHF and IFF blades on the spine and belly and a flush GPS patch; most CNI antennas are buried flush in the skin.',
    }, mesh(merge(ant), F.wing()));
  }
  return { tanks };
}
