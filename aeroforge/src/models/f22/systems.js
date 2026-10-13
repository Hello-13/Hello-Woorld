// F-22A utility systems, each traceable end to end in the Systems view:
//   fuel        tanks → transfer pumps → feed tank → boost pumps → engine feed lines → engine pump;
//               refuelling receptacle → manifold → tanks; vent / dump; inert-gas (OBIGGS) system
//   hydraulics  engine-driven pumps → system A (right) / B (left) lines → actuators; reservoirs,
//               accumulators; utility lines to the landing gear and brakes
//   electrical  generators → aft and forward distribution centres → converters → loads; APU,
//               stored-energy system, batteries
//   ECS         engine bleed → heat exchangers → air-cycle machine → cockpit and avionics; PAO
//               liquid loop → fuel–PAO heat exchangers; OBOGS; engine-bay and dry-bay fire protection
// Avionics, sensors, antennas and lights are in ./avionics.js.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { M } from '../../engine/materials.js';
import { naca00, mirrorZ } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, slab, hinge, mirror } from './util.js';

const { X, mono, lerp, smooth } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);

const ductCols = [1, 2, 3, 4, 5].map((c) => FR.DUCT.map((r) => [r[0], r[c]]));
/** Inlet duct centre, size at station s (right side). */
export function ductAt(s) { const [zc, yc, w, h] = ductCols.map((k) => mono(k, s)); return { zc, yc, w, h }; }
export function ductTop(s, z) {
  const { zc, yc, w, h } = ductAt(s);
  const u = Math.abs(z - zc) / (w / 2);
  if (u >= 1) return yc;
  return yc + (h / 2) * Math.pow(1 - Math.pow(u, 3), 1 / 3);
}

/** Outward normal of the forward-fuselage upper surface at (s, z) (z signed). */
export function normalA(s, z) {
  const az = Math.abs(z), e = 0.01;
  const dy = (FR.upperA(s, az + e) - FR.upperA(s, az - e)) / (2 * e);
  return V(0, 1, -dy * Math.sign(z)).normalize();
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
  const EZ = FR.ENG_Z;

  // ================================================================== fuel
  // F-1 behind the cockpit over the inlet ducts, with a well in its top for the refuelling receptacle
  const st1 = [7.08, 7.3, 7.5, 7.64, 7.78, 8.0, 8.2, 8.35];
  const recWell = (s, z) => 0.24 * smooth(7.5, 7.7, s) * (1 - smooth(0.15, 0.25, z));
  const t1 = tankLoft(st1, (s) => {
    const zA = FR.aW(s) - 0.1;
    const zs = [0, 0.08, 0.15, 0.2, 0.25, 0.32, ...range(0.4, zA, 4)];
    const half = zs.map((z) => [z, FR.topAt(s, z) - 0.07 - recWell(s, z)]);
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
    system: 'Fuel', material: 'Integral tank in the fuselage structure, nitrogen-enriched-air inerted', mass: kg[0],
    explode: [0.6, 1.9, 0],
    desc: `Behind the cockpit, over the inlet ducts, with a well in its top for the refuelling receptacle. Modelled capacity ≈ ${kg[0].toLocaleString('en-US')} kg (${L(kg[0]).toLocaleString('en-US')} L) of JP-8 — tank sizes are estimates scaled so all tanks hold the published 8,200 kg; mass shown is the fuel.`,
  }, mesh(t1.geo, fuelMat)));
  tanks.push(P('Centre fuselage tank (F-2)', {
    system: 'Fuel', material: 'Integral tank wrapped over the inlet ducts and weapons bay', mass: kg[1],
    explode: [0, 2.15, 0], callout: false,
    desc: `The largest tank, saddled over both inlet ducts and the main weapons bay. Modelled capacity ≈ ${kg[1].toLocaleString('en-US')} kg (${L(kg[1]).toLocaleString('en-US')} L, estimate). Fuel is also the jet's main heat sink: avionics heat is dumped into it.`,
  }, mesh(t2.geo, fuelMat)));
  tanks.push(P('Aft fuselage feed tank (F-3)', {
    system: 'Fuel', material: 'Integral tank with boost pumps', mass: kg[2],
    explode: [-0.3, 2.0, 0],
    desc: `Just ahead of the engines. Every other tank transfers into it, and its boost pumps keep both engines fed in any attitude, including inverted and high-g flight. Modelled capacity ≈ ${kg[2].toLocaleString('en-US')} kg (estimate).`,
  }, mesh(t3.geo, fuelMat)));
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    tanks.push(P(`Wing tank (${R})`, {
      system: 'Fuel', material: 'Integral (wet) wing box, sealed', mass: kg[3],
      explode: [0, 0.8, 2.55 * side],
      desc: `The wing box itself is the tank, between the front and rear spars. Modelled capacity ≈ ${kg[3].toLocaleString('en-US')} kg (estimate). Two 600 US gal (2,270 L) tanks can be hung on the inboard hardpoints for ferry flights, at the cost of stealth.`,
    }, mesh(side > 0 ? tw.geo : mirror(tw.geo), fuelMat)));
  }
  // pumps: transfer pumps in the wing roots and F-2, boost pumps in the bottom of F-3
  {
    const g = [];
    for (const side of [1, -1]) {
      const sec = FR.wingSection(2.05);
      g.push(FR.cylX(FR.SN - (sec.le[0] - 0.6 * sec.chord), sec.le[1] - 0.03, side * 2.05, 0.22, 0.06, 0.06, 14));
      g.push(FR.cylX(11.6, -0.12, side * 0.32, 0.22, 0.055, 0.055, 14));
    }
    P('Fuel transfer pumps', {
      system: 'Fuel', material: 'Electrically driven centrifugal pumps', mass: 24, count: 4,
      explode: [0, 1.0, 0.9],
      desc: 'Pumps in each wing-root tank and in F-2 move fuel toward the feed tank in a set sequence, so the centre of gravity stays where the flight controls expect it as fuel burns off.',
    }, mesh(merge(g), F.orange()));
    const b = [];
    for (const side of [1, -1]) {
      b.push(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14).translate(X(13.1), -0.3, side * 0.35));
      b.push(new THREE.BoxGeometry(0.12, 0.05, 0.12).translate(X(13.1), -0.36, side * 0.35));
    }
    P('Feed-tank boost pumps', {
      system: 'Fuel', material: 'Submerged electric boost pumps with ejector pumps', mass: 16, count: 2,
      explode: [-0.6, 0.7, 0],
      desc: 'Submerged in the bottom of the feed tank, one per engine, they push fuel at positive pressure into the engine feed lines so the engine pumps never cavitate, even at high altitude or under negative g.',
    }, mesh(merge(b), F.orange()));
  }
  {
    // transfer lines: wings and F-2 → feed tank
    const g = [];
    for (const side of [1, -1]) {
      g.push(FR.pipe([[11.4, -0.05, side * 2.2], [11.6, -0.12, side * 1.7], [11.9, -0.16, side * 0.7], [12.6, -0.3, side * 0.3]], 0.03, 6));
      g.push(FR.pipe([[8.4, 0.1, side * 0.3], [10.5, -0.1, side * 0.25], [11.5, -0.12, side * 0.32], [12.6, -0.25, side * 0.22]], 0.025, 6));
    }
    g.push(FR.pipe([[7.5, -0.4, 0.12], [8.2, -0.25, 0.2], [8.6, -0.1, 0.25]], 0.025, 6));
    P('Fuel transfer lines', {
      system: 'Fuel', material: 'Aluminium / titanium tubing', mass: 45,
      explode: [0, 1.25, 0],
      desc: 'Carry fuel from the wing tanks, F-1 and F-2 to the feed tank. The tanks are interconnected so a damaged tank can be isolated and the rest still feed both engines.',
    }, mesh(merge(g), F.pipe()));
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left';
      const ez = EZ * side, fy = FR.ENG_Y - 0.7;
      P(`Engine feed line (${R})`, {
        system: 'Fuel', material: 'Self-sealing titanium feed line with shut-off valve', mass: 8,
        explode: [-0.9, 0.2, 0.7 * side],
        desc: 'Runs from its boost pump in the feed tank, through a fire shut-off valve at the engine-bay firewall, to the engine-mounted fuel pump on the gearbox.',
      }, mesh(merge([FR.pipe([[13.1, -0.38, side * 0.35], [13.22, -0.52, side * 0.48], [13.34, -0.66, side * 0.7], [13.46, fy + 0.02, ez + side * 0.1]], 0.024, 6, 12),
        new THREE.BoxGeometry(0.06, 0.08, 0.08).translate(X(13.3), -0.62, side * 0.62)]), F.pipe()));
    }
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
      desc: 'A USAF flying-boom receptacle centred on the spine behind the canopy, in its own well in the top of tank F-1. A tanker\'s boom plugs in here; at full rate it can refill the internal tanks in a few minutes.',
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
    // refuel manifold: receptacle → F-1 → gallery along the spine → F-2, F-3 and both wings
    const m = [];
    m.push(FR.pipe([[8.28, FR.topAt(8.28, 0) - 0.2, 0], [8.4, 0.2, 0.08], [9.0, 0.32, 0.18], [11.0, 0.32, 0.2], [12.6, 0.28, 0.2]], 0.03, 6));
    for (const side of [1, -1]) m.push(FR.pipe([[10.6, 0.32, side * 0.2], [10.9, 0.25, side * 0.9], [11.2, 0.05, side * 1.95], [11.4, 0.0, side * 2.4]], 0.022, 6));
    m.push(FR.pipe([[8.3, FR.topAt(8.3, 0) - 0.22, 0], [8.0, 0.1, -0.1], [7.7, -0.1, -0.15]], 0.022, 6));
    P('Refuelling manifold', {
      system: 'Fuel', material: 'Aluminium manifold with level-control shut-off valves', mass: 22,
      explode: [0.1, 2.35, 0],
      desc: 'Distributes fuel from the receptacle (or a ground pressure-refuelling point) to every tank; float-operated shut-off valves close each tank as it fills.',
    }, mesh(merge(m), F.pipe()));
  }
  {
    // quantity probes: vertical capacitance probes through each tank
    const g = [];
    const probe = (s, z, y0, y1) => g.push(new THREE.CylinderGeometry(0.012, 0.012, y1 - y0, 6).translate(X(s), (y0 + y1) / 2, z));
    probe(7.3, 0.4, -0.42, FR.topAt(7.3, 0.4) - 0.09);
    probe(8.1, -0.45, -0.42, FR.topAt(8.1, 0.45) - 0.09);
    for (const [s, z] of [[9.0, 0.3], [10.2, -0.3], [11.4, 0.3], [9.6, -1.3], [10.8, 1.3]]) probe(s, z, ductTop(s, Math.abs(z)) + 0.07, FR.topAt(s, Math.abs(z)) - 0.09);
    probe(12.85, 0.2, -0.35, FR.topAt(12.85, 0.2) - 0.09);
    probe(12.85, -0.6, ductTop(12.85, 0.6) + 0.07, FR.topAt(12.85, 0.6) - 0.09);
    for (const side of [1, -1]) {
      for (const z of [2.4, 3.4, 4.6]) {
        const sec = FR.wingSection(z);
        const sx = sec.le[0] - 0.42 * sec.chord;
        const h = naca00(0.42, sec.t) * sec.chord * 0.8;
        g.push(new THREE.CylinderGeometry(0.01, 0.01, 2 * h, 6).translate(sx, sec.le[1], side * z));
      }
    }
    P('Fuel quantity probes', {
      system: 'Fuel', material: 'Capacitance gauging probes', mass: 8, count: 15,
      explode: [0, 2.9, 0.4],
      desc: 'Capacitance probes in every tank measure the fuel height (fuel and air have different permittivity); the fuel-management computer turns them into mass, which the up-front displays show (probe count illustrative).',
    }, mesh(merge(g), F.copper()));
  }
  P('Fuel vent & dump system', {
    system: 'Fuel', material: 'Titanium vent lines, dump mast between the nozzles', mass: 18,
    explode: [-1.0, -0.2, 0],
    desc: 'Vent lines keep tank pressure in limits as fuel is used and altitude changes; a dump line exits between the nozzles so fuel can be jettisoned to reach a safe landing weight.',
  }, mesh(merge([FR.pipe([[12.9, 0.2, 0.1], [14.5, 0.3, 0.1], [16.5, 0.25, 0.08], [17.6, -0.05, 0.0], [18.05, -0.08, 0.0]], 0.025, 6), FR.cylX(18.08, -0.08, 0, 0.12, 0.035, 0.03, 10)]), F.pipe()));
  {
    // OBIGGS: an air-separation module strips oxygen from bleed air; nitrogen-enriched air fills the ullage
    const g = [FR.cylX(7.2, -0.6, 0, 0.5, 0.075, 0.075, 16), FR.cylX(6.92, -0.6, 0, 0.06, 0.09, 0.09, 16)];
    const l = [];
    l.push(FR.pipe([[7.45, -0.6, 0], [7.6, -0.5, 0.05], [7.7, -0.4, 0.05]], 0.016, 5));
    l.push(FR.pipe([[7.7, -0.4, 0.05], [8.45, 0.05, 0.1], [9.0, 0.42, 0.1], [11.5, 0.42, 0.1], [12.8, 0.36, 0.1]], 0.014, 5));
    for (const side of [1, -1]) l.push(FR.pipe([[11.0, 0.42, side * 0.1], [11.3, 0.3, side * 0.9], [11.6, 0.02, side * 2.0], [11.9, -0.07, side * 3.0]], 0.012, 5));
    P('Inert-gas generating system (OBIGGS)', {
      system: 'Fuel', material: 'Hollow-fibre air-separation module, distribution lines', mass: 30,
      explode: [0.6, -1.65, 0],
      desc: 'An air-separation module passes engine bleed air through hollow fibres that let oxygen escape, leaving nitrogen-enriched air that is piped into the space above the fuel in every tank, so a hit cannot ignite the vapour (module position approximate).',
    }, [mesh(merge(g), F.boxLight()), mesh(merge(l), F.pipe())]);
  }

  // ================================================================== hydraulics: two independent 4,000 psi systems
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
    const S = side > 0 ? 'A' : 'B';
    P(`Hydraulic reservoir (system ${S})`, {
      system: 'Hydraulics', material: 'Bootstrap (self-pressurising) piston reservoir', mass: 15,
      explode: [0.1, -1.25, 0.55 * side],
      desc: `System ${S} has its own pressurised reservoir, so a leak in one system cannot drain the other. A bootstrap piston keeps the fluid under pressure so the pumps are fed at any altitude or attitude.`,
    }, mesh(merge([FR.cylX(13.0, -0.62, side * 0.5, 0.42, 0.09, 0.09, 14), FR.cylX(13.25, -0.62, side * 0.5, 0.08, 0.05, 0.05, 10)]), F.hyd()));
    P(`Hydraulic accumulators (system ${S})`, {
      system: 'Hydraulics', material: 'Nitrogen-charged steel accumulators', mass: 10,
      explode: [0.2, -1.45, 0.3 * side],
      desc: `A gas-charged accumulator on system ${S} smooths pump ripple and supplies peak flow when several actuators move at once.`,
    }, mesh(new THREE.SphereGeometry(0.09, 14, 10).translate(X(12.75), -0.62, side * 0.17), F.steel()));
  }
  P('Brake & emergency accumulator', {
    system: 'Hydraulics', material: 'Nitrogen-charged steel accumulator', mass: 6,
    explode: [0.2, -1.6, 0],
    desc: 'Holds a reserve of pressurised fluid for the wheel brakes and emergency gear extension if both pumps are lost.',
  }, mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10).rotateZ(Math.PI / 2).translate(X(12.5), -0.66, 0), F.steel()));
  for (const side of [1, -1]) {
    const z = side, S = side > 0 ? 'A' : 'B';
    const g = [];
    // pump → reservoir / manifold, then aft to the stabilator, rudder and nozzle area, outboard to the wing
    g.push(FR.pipe([[14.2, -0.42, z * 1.38], [13.6, -0.5, z * 1.0], [13.2, -0.6, z * 0.6]], 0.016, 5));
    g.push(FR.pipe([[14.2, -0.42, z * 1.38], [15.5, -0.35, z * 1.4], [16.2, -0.26, z * 1.38]], 0.016, 5));
    g.push(FR.pipe([[14.6, -0.35, z * 1.4], [14.6, 0.15, z * 1.42], [14.9, 0.3, z * 1.42], [16.4, 0.36, z * 1.45]], 0.014, 5));
    g.push(FR.pipe([[13.2, -0.55, z * 1.0], [13.4, -0.15, z * 1.6], [13.6, -0.1, z * 2.6], [13.9, -0.15, z * 4.2]], 0.014, 5));
    // forward along the bay edge to the leading-edge flap drive, bay doors and nose
    g.push(FR.pipe([[13.2, -0.6, z * 0.6], [12.6, -0.7, z * 0.84], [10.5, -0.74, z * 0.84], [8.5, -0.7, z * 0.84], [8.0, -0.5, z * 1.2], [8.6, -0.1, z * 1.75]], 0.016, 5, 40));
    // crossfeed: each system also reaches the other side's stabilator and rudder actuators
    g.push(FR.pipe([[16.0, -0.3, z * 1.38], [16.1, -0.55, z * 0.6], [16.15, -0.58, -z * 0.6], [16.25, -0.3, -z * 1.3]], 0.012, 5));
    P(`Hydraulic lines (system ${S})`, {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi)', mass: 35,
      explode: [0, -0.6, 0.35 * side],
      desc: `System ${S} lines run from the ${side > 0 ? 'right' : 'left'} pumps to the stabilator, rudder, flaperon, aileron and leading-edge-flap actuators on both sides — every primary flight-control actuator is fed by both systems — and to the weapons-bay doors and launchers.`,
    }, mesh(merge(g), F.hyd()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      g.push(FR.pipe([[12.5, -0.62, side * 0.06], [12.2, -0.62, side * 0.5], [11.6, -0.55, side * 0.88], [11.3, -0.48, side * 1.0], [11.24, -0.47, side * 1.02]], 0.012, 5));
      g.push(FR.pipe([[11.6, -0.55, side * 0.88], [11.42, -0.5, side * 1.1], [11.3, -0.55, side * 1.28]], 0.01, 5));      // brake line to the strut
      g.push(FR.pipe([[12.3, -0.6, side * 0.75], [12.6, -0.52, side * 0.95]], 0.01, 5));                                  // door jack
    }
    g.push(FR.pipe([[12.5, -0.66, 0.05], [10.0, -0.86, 0.79], [7.0, -0.55, 0.3], [5.8, -0.2, 0.2], [4.6, -0.12, 0.08], [4.36, -0.11, 0.02]], 0.012, 5, 60));
    P('Landing-gear & brake hydraulic lines', {
      system: 'Hydraulics', material: 'Titanium and steel tubing, flexible hoses across the gear pivots', mass: 18,
      explode: [0.3, -1.55, 0],
      desc: 'Utility lines from the manifold beside the accumulators to the main and nose gear actuators, the door jacks, nose-wheel steering and the wheel brakes; flexible hoses cross each trunnion.',
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
  // APU embedded in the left wing root, between two wing spars, exhausting through the upper skin
  P('Auxiliary power unit (APU)', {
    system: 'Electrical', material: 'Small gas turbine, 335 kW (450 hp) class', mass: 75,
    explode: [0.2, 0.9, -1.3],
    desc: 'Part of the auxiliary power generation system (AlliedSignal, now Honeywell), embedded in the left wing root: it starts the engines without ground carts and can restart them in flight. Inlet and exhaust door positions are approximate.',
  }, mesh(merge([FR.cylX(11.95, -0.08, -1.8, 0.56, 0.1, 0.09, 18), box(11.62, -0.08, -1.8, 0.1, 0.2, 0.2),
    FR.pipe([[12.2, -0.08, -1.8], [12.3, -0.06, -1.82], [12.36, 0.0, -1.84]], 0.045, 8, 6)]), F.boxLight()));
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
  P('Aft power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers and contactors', mass: 30, count: 2,
    explode: [-0.4, -1.05, 0],
    desc: 'Beside the keel ahead of the engine bays, they take each generator\'s 270 V DC output, switch it onto the buses and protect the aft loads (location approximate).',
  }, mesh(merge([box(13.8, -0.62, 0.1, 0.4, 0.12, 0.1), box(13.8, -0.62, -0.1, 0.4, 0.12, 0.1)]), F.box()));
  P('Forward power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers, circuit-breaker-free', mass: 40, count: 2,
    explode: [0.5, -0.65, 0],
    desc: 'Under the cockpit floor, they feed the avionics, cockpit and forward loads; solid-state controllers replace most circuit breakers and can reset a fault from the cockpit.',
  }, mesh(merge([box(5.6, -0.27, 0.42, 0.6, 0.2, 0.12), box(5.6, -0.27, -0.42, 0.6, 0.2, 0.12)]), F.box()));
  P('Converter-regulators (270 V → 28 V DC)', {
    system: 'Electrical', material: 'Solid-state DC–DC converters', mass: 20, count: 2,
    explode: [0.6, -1.2, 0.5],
    desc: 'Step the 270 V DC primary power down to 28 V DC for the many standard-voltage loads (lights, valves, older equipment); inverters supply the few AC loads.',
  }, mesh(merge([box(6.15, -0.32, 0.42, 0.24, 0.18, 0.11), box(6.15, -0.32, -0.42, 0.24, 0.18, 0.11)]), F.boxLight()));
  {
    const g = [];
    for (const z of [1, -1]) {
      g.push(FR.pipe([[3.0, -0.2, z * 0.25], [5.0, -0.3, z * 0.36], [6.3, -0.3, z * 0.48], [7.5, -0.52, z * 0.55], [9.0, -0.215, z * 0.62], [12.3, -0.215, z * 0.62], [12.9, -0.45, z * 0.3], [13.6, -0.6, z * 0.12]], 0.022, 6, 70));
      g.push(FR.pipe([[13.7, -0.6, z * 0.16], [13.45, -0.56, z * 0.9], [13.3, -0.45, z * 1.28]], 0.02, 6));           // generator feeders
      g.push(FR.pipe([[13.9, -0.6, z * 0.12], [15.5, -0.6, z * 0.12], [16.2, -0.4, z * 0.15]], 0.016, 5));             // aft loads
    }
    P('Main wiring harnesses', {
      system: 'Electrical', material: 'Shielded copper harnesses in conduits', mass: 120,
      explode: [0.3, -0.35, 0],
      desc: 'Two separated harness runs, one down each side, link the generators, distribution centres and loads; keeping them apart means one hit cannot cut both.',
    }, mesh(merge(g), F.box()));
  }

  // ================================================================== environmental control & thermal management
  {
    // engine bleed air forward along the weapons-bay edges to the ECS bay under the cockpit
    const g = [];
    for (const side of [1, -1]) g.push(FR.pipe([[14.55, -0.6, side * 0.42], [14.0, -0.62, side * 0.5], [13.3, -0.6, side * 0.66], [12.6, -0.55, side * 0.82], [8.6, -0.52, side * 0.82], [7.6, -0.56, side * 0.5], [6.6, -0.48, side * 0.3]], 0.03, 8, 60));
    P('Engine bleed-air ducts', {
      system: 'Environmental control', material: 'Insulated titanium ducting with shut-off and pressure-regulating valves', mass: 30,
      explode: [0.2, -1.05, 0],
      desc: 'Hot, high-pressure air tapped from each engine\'s compressor runs forward to the environmental control system and the inert-gas generator; valves at each engine shut it off in a fire (routing approximate).',
    }, mesh(merge(g), F.tiDull()));
    P('ECS heat exchangers', {
      system: 'Environmental control', material: 'Aluminium plate-fin cores, fuel- and ram-air cooled', mass: 45, count: 2,
      explode: [0.4, -1.3, -0.4],
      desc: 'Bleed air is first cooled in heat exchangers; with so few cooling inlets on a stealthy airframe, much of the heat goes into the fuel rather than into ram air.',
    }, mesh(merge([box(6.05, -0.42, 0.22, 0.32, 0.26, 0.24), box(6.05, -0.42, -0.22, 0.32, 0.26, 0.24)]), F.copper()));
    P('Air-cycle machine & water separator', {
      system: 'Environmental control', material: 'Turbine / compressor air-cycle machine, water separator', mass: 55,
      explode: [0.4, -1.5, 0],
      desc: 'Expanding the cooled bleed air through a turbine drops its temperature far below ambient; a water separator dries it before it goes to the cockpit and the air-cooled avionics (position approximate).',
    }, mesh(merge([FR.cylX(6.45, -0.45, 0, 0.36, 0.13, 0.11, 18), FR.cylX(6.7, -0.45, 0, 0.14, 0.08, 0.08, 14)]), F.boxLight()));
    const d = [];
    for (const side of [1, -1]) d.push(FR.pipe([[6.3, -0.4, side * 0.08], [6.4, -0.15, side * 0.3], [6.2, 0.05, side * 0.44], [5.4, 0.05, side * 0.44]], 0.035, 8));
    d.push(FR.pipe([[6.25, -0.45, 0], [5.0, -0.12, 0.3], [4.0, -0.1, 0.3], [3.3, -0.05, 0.36]], 0.03, 8));
    P('Cockpit & avionics air ducts', {
      system: 'Environmental control', material: 'Composite and aluminium ducting', mass: 15,
      explode: [0.5, -0.4, 0.2],
      desc: 'Carry conditioned air to the cockpit outlets, the canopy demist and the forward avionics bay, and keep the cockpit pressurised.',
    }, mesh(merge(d), F.duct()));
  }
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
    FR.pipe([[2.62, 0.0, 0.36], [3.0, -0.12, 0.38], [4.5, -0.28, 0.42], [6.0, -0.45, 0.42], [7.2, -0.6, 0.38]], 0.02, 6),
    FR.pipe([[2.62, 0.0, -0.36], [3.0, -0.12, -0.38], [4.5, -0.28, -0.42], [6.0, -0.45, -0.42], [7.2, -0.6, -0.38]], 0.02, 6),
    FR.pipe([[3.05, 0.3, 0.2], [3.3, 0.36, 0.0], [3.05, 0.3, -0.2]], 0.016, 6),
  ]), F.ductDark()));
  P('PAO pump & reservoir', {
    system: 'Environmental control', material: 'Electric coolant pump, pressurised reservoir', mass: 18,
    explode: [0.6, -1.65, 0.6],
    desc: 'Circulates the PAO coolant round the loop; the reservoir takes up its expansion as it heats.',
  }, mesh(merge([FR.cylX(6.95, -0.6, -0.35, 0.22, 0.07, 0.07, 14), new THREE.SphereGeometry(0.08, 14, 10).translate(X(6.95), -0.6, 0.35)]), F.boxLight()));
  P('OBOGS oxygen concentrator', {
    system: 'Environmental control', material: 'Molecular-sieve oxygen concentrator', mass: 18,
    explode: [0.2, 1.05, -0.6],
    desc: 'The on-board oxygen generation system strips nitrogen from engine bleed air to give the pilot breathing oxygen without liquid-oxygen servicing.',
  }, mesh(box(6.6, 0.12, -0.42, 0.24, 0.22, 0.16), F.boxLight()));
  {
    // fire protection: extinguisher bottles ahead of the engine bays, with spray lines into each bay
    const g = [];
    for (const z of [0.11, -0.11]) g.push(new THREE.SphereGeometry(0.08, 14, 10).translate(X(13.45), 0.36, z));
    const l = [];
    for (const side of [1, -1]) {
      l.push(FR.pipe([[13.45, 0.36, side * 0.18], [13.7, 0.5, side * 0.35], [14.5, 0.55, side * 0.42], [16.0, 0.5, side * 0.42]], 0.01, 5));
      l.push(FR.pipe([[14.0, 0.53, side * 0.4], [14.2, 0.45, side * 1.2], [14.4, 0.2, side * 1.36]], 0.008, 5));
    }
    P('Engine-bay fire extinguishers', {
      system: 'Environmental control', material: 'Pressurised extinguishing-agent bottles, spray tubes, fire / overheat detector loops', mass: 22, count: 2,
      explode: [-0.3, 1.55, 0],
      desc: 'Detector loops in each engine bay warn of fire or overheat; the pilot can then shut off fuel and fire one or both bottles, which flood the bay through spray tubes (agent and positions approximate).',
    }, [mesh(merge(g), F.red()), mesh(merge(l), F.pipe())]);
    const d = [];
    for (const side of [1, -1]) for (const s of [9.2, 10.4]) d.push(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8).rotateZ(Math.PI / 2).translate(X(s), FR.topAt(s, 1.5) - 0.1, side * 1.5));
    P('Dry-bay fire suppression', {
      system: 'Environmental control', material: 'Fast-acting suppressant canisters with optical fire detectors', mass: 10, count: 4,
      explode: [0, 1.75, 0.5],
      desc: 'Small canisters in the dry bays around the fuel tanks and inlet ducts fire within milliseconds of an optical sensor seeing a flash from a hit, smothering a fire before it can grow (positions approximate).',
    }, mesh(merge(d), F.orange()));
  }
  return { tanks };
}
