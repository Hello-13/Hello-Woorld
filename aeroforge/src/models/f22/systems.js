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
import { merge, slab, hinge, mirror, toothedGrid, rectTube } from './util.js';

const { X, mono, lerp, smooth, WM } = FR;
const SM = FR.M;               // fuselage station map (FR.M; M is the shared materials here)
/** Leading-edge-flap power drive unit at the wing root (airframe.js: z = SURF.lef[0] − 0.06, 10 % chord). */
const lefPdu = () => { const z = FR.SURF.lef[0] - 0.06; return [FR.wingLE(z) + 0.1 * (FR.wingTE(z) - FR.wingLE(z)), FR.wingY(z), z]; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Route points clamped inside the fuselage skin (the re-laid-out outer mould line). */
const inside = (pts, m = 0.03) => pts.map((p) => FR.inBody(p, m));
/** Out of the trunk into the wing root: up under the chine flange, where the wing joins it behind its leading edge. */
const toWingRoot = (z) => [[8.3, -0.15, z * (FR.wallZ(8.3, -0.15) - 0.05)], [8.62, -0.05, z * 2.06], [8.78, -0.035, z * 2.17]];
/** Fin mid-plane at height y, and the rudder actuator's lower end in the fin root (airframe.js). */
const finMid = (y) => FR.FIN.rootZ + (y - FR.FIN.rootY) * Math.tan(FR.FIN.cant);
const rudderAct = () => [FR.FIN.rootS + 0.64 * FR.FIN.rootC, FR.FIN.rootY + 0.3 * Math.cos(FR.FIN.cant), FR.FIN.rootZ + 0.3 * Math.sin(FR.FIN.cant)];
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
  // end caps are ear-clipped: a saddle outline is concave (it wraps over the inlet duct), so a fan from its
  // centroid would lay a lid across the duct's top
  const caps = [rings[0], rings[rings.length - 1]].map((r) => {
    const contour = r.map((p) => new THREE.Vector2(p[2], p[1]));
    const pos = [], idx = [];
    for (const p of r) pos.push(...p);
    for (const f of THREE.ShapeUtils.triangulateShape(contour, [])) idx.push(...f);
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
  let zO = Math.min(zo, zc + w / 2 - 0.12, FR.bW(Math.max(s, FR.S_AB)) - 0.45);
  const top = (z) => FR.topAt(s, z) - gapTop;
  // the underside follows the duct's real roof (highest wall point within ±5 cm), at least 3.5 cm above it
  const roof = (z) => { let h = ductTop(s, z); for (let dz = -0.05; dz <= 0.0501; dz += 0.025) { const sp = FR.ductSpan(s, z + dz); if (sp) h = Math.max(h, sp.hi); } return h; };
  const over = (z) => Math.max(roof(z) + 0.035, Math.min(roof(z) + 0.05, top(z) - 0.03));
  // only as far out over the duct as 3 cm of fuel depth remains (near the fan face the duct roof nears the deck)
  for (let z = zi; z <= zO; z += 0.01) if (top(z) - over(z) < 0.03) { zO = Math.max(zi + 0.01, z - 0.01); break; }
  const half = [];
  for (const z of range(0, zO, 7)) half.push([z, top(z)]);
  for (const z of range(zO, zi, 12)) half.push([z, over(z)]);
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
  const st1 = [SM(7.08), SM(7.3), SM(7.5), SM(7.64), SM(7.78), SM(8.0), SM(8.2), SM(8.35)];
  const recWell = (s, z) => 0.24 * smooth(SM(7.5), SM(7.7), s) * (1 - smooth(0.15, 0.25, z));
  const t1 = tankLoft(st1, (s) => {
    const zA = FR.aW(s) - 0.1;
    const zs = [0, 0.08, 0.15, 0.2, 0.25, 0.32, ...range(0.4, zA, 4)];
    const half = zs.map((z) => [z, FR.topAt(s, z) - 0.07 - recWell(s, z)]);
    half.push([Math.min(zA, FR.aLowerZ(s, -0.45) - 0.05), -0.45], [0, -0.45]);
    return half;
  });
  const st2 = range(SM(8.5), SM(12.3), 12);
  const t2 = tankLoft(st2, (s) => saddle(s, { ybot: -0.2 }));
  const st3 = range(SM(12.45), SM(13.25), 4);
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
    desc: `The largest tank, saddled over both inlet ducts and the main weapons bay. Modelled capacity ≈ ${kg[1].toLocaleString('en-US')} kg (${L(kg[1]).toLocaleString('en-US')} L, estimate). Fuel is also the jet's main heat sink: avionics heat is dumped into it. Public sources list eight internal tanks; the model groups them into five (cell layout approximate).`,
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
      g.push(FR.cylX(SM(11.6), -0.155, side * 0.32, 0.22, 0.055, 0.055, 14));
    }
    P('Fuel transfer pumps', {
      system: 'Fuel', material: 'Electrically driven centrifugal pumps', mass: 24, count: 4,
      explode: [0, 1.0, 0.9],
      desc: 'Pumps in each wing-root tank and in F-2 move fuel toward the feed tank in a set sequence, so the centre of gravity stays where the flight controls expect it as fuel burns off.',
    }, mesh(merge(g), F.orange()));
    const b = [];
    for (const side of [1, -1]) {
      // in the sump between the ducts (each duct's inboard wall is at |z| ≈ 0.29 here)
      b.push(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14).translate(X(SM(13.1)), -0.3, side * 0.19));
      b.push(new THREE.BoxGeometry(0.12, 0.05, 0.12).translate(X(SM(13.1)), -0.36, side * 0.19));
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
      // from each wing root under the gun's ammunition container, along the weapons-bay sill ahead of the gear
      // well and up over the bay's sloping aft ceiling into the bottom of F-3
      g.push(FR.pipe([[SM(11.3), -0.05, side * 2.2], [SM(11.32), -0.1, side * 1.85], [SM(11.35), -0.33, side * 1.6], [SM(11.42), -0.4, side * 1.3], [SM(11.5), -0.43, side * 1.02], [SM(11.6), -0.43, side * 0.89], [SM(12.0), -0.42, side * 0.88], [SM(12.2), -0.36, side * 0.76], [SM(12.38), -0.3, side * 0.56], [SM(12.5), -0.29, side * 0.4], [SM(12.6), -0.3, side * 0.28], [SM(12.68), -0.33, side * 0.12]], 0.025, 6, 60));
      g.push(FR.pipe([[SM(8.4), 0.1, side * 0.3], [SM(10.5), -0.08, side * 0.25], [SM(11.5), -0.155, side * 0.32], [SM(12.2), -0.19, side * 0.27], [SM(12.45), -0.2, side * 0.22], [SM(12.62), -0.29, side * 0.12]], 0.025, 6));
    }
    g.push(FR.pipe([[SM(7.5), -0.4, 0.12], [SM(8.2), -0.25, 0.2], [SM(8.6), -0.1, 0.25]], 0.025, 6));
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
      }, mesh(merge([FR.pipe([[SM(13.1), -0.37, side * 0.19], [SM(13.18), -0.45, side * 0.33], [SM(13.24), -0.48, side * 0.47], [SM(13.31), -0.6, side * 0.63], [SM(13.39), -0.68, side * 0.79], [SM(13.47), fy + 0.02, ez + side * 0.1]], 0.024, 6, 20),
        new THREE.BoxGeometry(0.06, 0.08, 0.08).translate(X(SM(13.35)), -0.645, side * 0.71)]), F.pipe()));
    }
  }
  {
    // dorsal air-refuelling receptacle: slipway trough with the nozzle socket at its aft end
    const g = [];
    const s0 = SM(7.75), s1 = SM(8.3);
    const prof = (s) => [[0.15, FR.topAt(s, 0.15) - 0.01], [0.12, FR.topAt(s, 0) - 0.24], [-0.12, FR.topAt(s, 0) - 0.24], [-0.15, FR.topAt(s, 0.15) - 0.01]].map(([z, y]) => [X(s), y, z]);
    g.push(FR.gridSurface([prof(s0), prof((s0 + s1) / 2), prof(s1)], { closed: false, uv: 'n' }));
    g.push(FR.cylX(SM(8.22), FR.topAt(SM(8.22), 0) - 0.17, 0, 0.12, 0.05, 0.08, 14));
    P('Air-refuelling receptacle', {
      system: 'Fuel', material: 'Aluminium slipway and receptacle', mass: 25,
      explode: [0.2, 2.7, 0],
      desc: 'A USAF flying-boom receptacle centred on the spine behind the canopy, in its own well in the top of tank F-1. A tanker\'s boom plugs in here; at full rate it can refill the internal tanks in a few minutes.',
    }, mesh(merge(g), F.yellow()));
    const grid = toothedGrid((s, u) => { const z = lerp(-0.15, 0.15, u); return [X(s), FR.topAt(s, Math.abs(z)) + 0.003, z]; }, [s0, (s0 + s1) / 2, s1], { width: 0.3 });
    const door = slab(grid, () => [0, -0.02, 0], V(0, 1, 0));
    const h = hinge(mesh(door, F.door()), V(X(s1), FR.topAt(s1, 0.15), -0.15), V(X(s1), FR.topAt(s1, 0.15), 0.15), V(X(s0), 0.7, 0), V(0, -1, 0));
    P('Air-refuelling door', {
      system: 'Skin & fairings', skin: true, material: 'Composite door, saw-tooth edges', mass: 6,
      explode: [0.2, 3.2, 0],
      desc: 'Rotates down into the spine to expose the receptacle and its lights, and closes flush afterwards; its fore and aft edges are saw-toothed like every other door.',
    }, h.pivot);
    anim.arDoor = h;
    // slipway floodlights in the walls of the receptacle well, lighting it for the boom operator at night
    const lens = [], lit = [];
    for (const zz of [-0.135, 0.135]) for (const sl of [SM(7.85), SM(8.15)]) {
      const y = FR.topAt(sl, 0) - 0.1;
      lens.push(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2).translate(X(sl), y, zz));
      lit.push(new THREE.CircleGeometry(0.024, 12).rotateY(zz > 0 ? Math.PI : 0).translate(X(sl), y, zz - Math.sign(zz) * 0.011));
    }
    const arLamp = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff4dc, emissiveIntensity: 0.25, roughness: 0.4 });
    P('Air-refuelling lights', {
      system: 'Electrical', material: 'Slipway floodlights, 28 V DC', mass: 1, count: 4,
      explode: [0.2, 2.95, 0.4],
      desc: 'Floodlights set into the receptacle well light the slipway so the tanker\'s boom operator can see to plug in at night (count and positions approximate).',
    }, [mesh(merge(lens), F.lens()), mesh(merge(lit), arLamp, { cast: false })]);
    // refuel manifold: receptacle → F-1 → gallery along the spine, in the slot between the two ducts → F-2, F-3
    // and both wings
    const m = [];
    m.push(FR.pipe([[SM(8.28), FR.topAt(SM(8.28), 0) - 0.2, 0], [SM(8.4), 0.2, 0.03], [SM(9.0), 0.32, 0], [SM(11.0), 0.32, 0], [SM(12.52), 0.28, 0]], 0.03, 6));
    // wing branches: a tee down the slot, then outboard under the duct floor (the duct roof runs too close to the
    // skin to pass over it), below the gun's ammunition container and into each wing tank through the root rib
    m.push(FR.pipe([[SM(10.55), 0.32, 0], [SM(10.62), 0.1, 0], [SM(10.7), -0.12, 0], [SM(10.74), -0.17, 0]], 0.022, 6, 8));
    for (const side of [1, -1]) m.push(FR.pipe([[SM(10.74), -0.17, 0], [SM(10.8), -0.17, side * 0.2], [SM(10.86), -0.17, side * 0.5], [SM(10.92), -0.17, side * 0.8], [SM(10.98), -0.29, side * 1.1], [SM(11.03), -0.31, side * 1.45], [SM(11.08), -0.29, side * 1.72], [SM(11.11), -0.23, side * 1.86], [SM(11.14), -0.15, side * 1.95], [SM(11.2), -0.11, side * 2.15], [SM(11.27), -0.1, side * 2.4]], 0.022, 6, 48));
    m.push(FR.pipe([[SM(8.3), FR.topAt(SM(8.3), 0) - 0.22, 0], [SM(8.0), 0.1, -0.1], [SM(7.7), -0.1, -0.15]], 0.022, 6));
    P('Refuelling manifold', {
      system: 'Fuel', material: 'Aluminium manifold with level-control shut-off valves', mass: 22,
      explode: [0.1, 2.35, 0],
      desc: 'Distributes fuel from the receptacle (or the ground pressure-refuelling point) to every tank; float-operated shut-off valves close each tank as it fills.',
    }, mesh(merge(m), F.pipe()));
    // single-point pressure-refuelling adapter on the forward wall of the right main-gear well, facing aft, reached
    // through the open leg slot; its line runs up outboard of the S-duct and forward over it into F-2
    const ga = [];
    const wS = FR.MAIN_WELL.cav0, wZ = 1.26;
    ga.push(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 16).rotateZ(Math.PI / 2 + 0.35).translate(X(wS + 0.06), -0.69, wZ));
    ga.push(new THREE.BoxGeometry(0.03, 0.14, 0.14).translate(X(wS + 0.025), -0.68, wZ));
    ga.push(FR.pipe(inside([[wS + 0.025, -0.68, wZ], [wS - 0.02, -0.55, wZ], [wS - 0.05, -0.2, wZ - 0.02], [wS - 0.15, 0.1, wZ - 0.05], [10.6, 0.25, 1.12], [10.2, 0.36, 1.0], [10.0, 0.4, 0.85]], 0.04), 0.022, 6, 24));
    P('Ground refuelling adapter', {
      system: 'Fuel', material: 'Single-point pressure-refuelling coupling with shut-off valve', mass: 5,
      explode: [0.3, -1.25, 1.5],
      desc: 'A ground crew refuels every tank through this one coupling on the forward wall of the right main-gear well, under pressure from a truck or hydrant, with the same level-control valves that stop each tank filling (position approximate).',
    }, mesh(merge(ga), F.yellow()));
  }
  {
    // quantity probes: vertical capacitance probes through each tank
    const g = [];
    const probe = (s, z, y0, y1) => { if (y1 - y0 > 0.06) g.push(new THREE.CylinderGeometry(0.012, 0.012, y1 - y0, 6).translate(X(s), (y0 + y1) / 2, z)); };
    probe(SM(7.3), 0.4, -0.42, FR.topAt(SM(7.3), 0.4) - 0.09);
    probe(SM(8.1), -0.45, -0.42, FR.topAt(SM(8.1), 0.45) - 0.09);
    // F-2: in the slot between the ducts (and, forward, inboard of them), from just above its floor to the top
    for (const [s, z] of [[SM(9.0), 0.45], [SM(9.8), -0.25], [SM(11.0), -0.07], [SM(11.8), -0.07]]) probe(s, z, -0.17, FR.topAt(s, Math.abs(z)) - 0.09);
    probe(SM(12.75), -0.08, -0.35, FR.topAt(SM(12.75), 0.08) - 0.09);
    probe(SM(12.85), -0.6, ductTop(SM(12.85), 0.6) + 0.07, FR.topAt(SM(12.85), 0.6) - 0.09);
    for (const side of [1, -1]) {
      for (const z of [2.4, 3.4, 4.6]) {
        const sec = FR.wingSection(z);
        const sx = sec.le[0] - 0.42 * sec.chord;
        const h = naca00(0.42, sec.t) * sec.chord * 0.8;
        g.push(new THREE.CylinderGeometry(0.01, 0.01, 2 * h, 6).translate(sx, sec.le[1], side * z));
      }
    }
    P('Fuel quantity probes', {
      system: 'Fuel', material: 'Capacitance gauging probes', mass: 8, count: 14,
      explode: [0, 2.9, 0.4],
      desc: 'Capacitance probes in every tank measure the fuel height (fuel and air have different permittivity); the fuel-management computer turns them into mass, which the up-front displays show (probe count illustrative).',
    }, mesh(merge(g), F.copper()));
  }
  P('Fuel vent & dump system', {
    system: 'Fuel', material: 'Titanium vent lines, dump mast between the nozzles', mass: 18,
    explode: [-1.0, -0.2, 0],
    desc: 'Vent lines keep tank pressure in limits as fuel is used and altitude changes; a dump line exits between the nozzles so fuel can be jettisoned to reach a safe landing weight.',
  }, mesh(merge([FR.pipe([[SM(12.9), 0.2, 0.1], [SM(14.5), 0.3, 0.1], [SM(16.5), 0.25, 0.08], [SM(17.6), -0.05, 0.0], [SM(18.05), -0.08, 0.0]], 0.025, 6), FR.cylX(SM(18.08), -0.08, 0, 0.12, 0.035, 0.03, 10)]), F.pipe()));
  {
    // OBIGGS: an air-separation module strips oxygen from bleed air; nitrogen-enriched air fills the ullage
    const g = [FR.cylX(SM(7.2), -0.6, 0, 0.5, 0.075, 0.075, 16), FR.cylX(SM(6.92), -0.6, 0, 0.06, 0.09, 0.09, 16)];
    const l = [];
    l.push(FR.pipe([[SM(7.45), -0.6, 0], [SM(7.6), -0.5, 0.05], [SM(7.7), -0.4, 0.05]], 0.016, 5));
    l.push(FR.pipe([[SM(7.7), -0.4, 0.05], [SM(8.45), 0.05, 0.1], [SM(9.0), 0.42, 0.1], [SM(11.5), 0.42, 0.1], [SM(12.8), 0.36, 0.1]], 0.014, 5));
    // wing branches follow the refuelling branches a little further forward: down the slot between the ducts,
    // outboard under the duct floor and the ammunition container, into the wing tanks
    l.push(FR.pipe([[SM(10.3), 0.42, 0.1], [SM(10.36), 0.2, 0.09], [SM(10.42), -0.05, 0.08], [SM(10.46), -0.13, 0.08]], 0.012, 5, 8));
    for (const side of [1, -1]) l.push(FR.pipe([[SM(10.46), -0.13, 0.08], [SM(10.52), -0.14, side * 0.25], [SM(10.6), -0.14, side * 0.5], [SM(10.68), -0.155, side * 0.8], [SM(10.76), -0.26, side * 1.1], [SM(10.84), -0.28, side * 1.45], [SM(10.9), -0.27, side * 1.72], [SM(10.94), -0.21, side * 1.86], [SM(10.98), -0.13, side * 1.95], [SM(11.05), -0.1, side * 2.15], [SM(11.1), -0.09, side * 2.3]], 0.012, 5, 44));
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
    for (const dy of [0.0, 0.14]) g.push(FR.cylX(SM(14.22), -0.47 + dy, side * 1.38, 0.32, 0.06, 0.055, 14));
    g.push(box(SM(14.05), -0.4, side * 1.38, 0.06, 0.3, 0.16));
    P(`Hydraulic pumps (${R} AMAD)`, {
      system: 'Hydraulics', material: 'Eaton PV3-115 variable-displacement piston pumps', mass: 32, count: 2,
      explode: [-0.1, -1.0, 1.0 * side],
      desc: `Engine-driven pumps on the ${R} accessory drive pressurise ${side > 0 ? 'system A' : 'system B'} at 4,000 psi (27.6 MPa) — higher than the usual 3,000 psi, so actuators and lines can be smaller and lighter. Eaton\'s PV3-115 was qualified for this duty with an 8,000-hour design life; the number of pumps per AMAD is not published (two are drawn).`,
    }, mesh(merge(g), F.hyd()));
    const S = side > 0 ? 'A' : 'B';
    P(`Hydraulic reservoir (system ${S})`, {
      system: 'Hydraulics', material: 'Bootstrap (self-pressurising) piston reservoir', mass: 15,
      explode: [0.1, -1.25, 0.55 * side],
      desc: `System ${S} has its own pressurised reservoir, so a leak in one system cannot drain the other. A bootstrap piston keeps the fluid under pressure so the pumps are fed at any altitude or attitude.`,
    }, mesh(merge([FR.cylX(SM(13.07), -0.62, side * 0.3, 0.42, 0.09, 0.09, 14), FR.cylX(SM(13.32), -0.62, side * 0.3, 0.08, 0.05, 0.05, 10)]), F.hyd()));
    P(`Hydraulic accumulators (system ${S})`, {
      system: 'Hydraulics', material: 'Nitrogen-charged steel accumulators', mass: 10,
      explode: [0.2, -1.45, 0.3 * side],
      desc: `A gas-charged accumulator on system ${S} smooths pump ripple and supplies peak flow when several actuators move at once.`,
    }, mesh(new THREE.SphereGeometry(0.09, 14, 10).translate(X(SM(12.75)), -0.62, side * 0.17), F.steel()));
  }
  P('Brake & emergency accumulator', {
    system: 'Hydraulics', material: 'Nitrogen-charged steel accumulator', mass: 6,
    explode: [0.2, -1.6, 0],
    desc: 'Holds a reserve of pressurised fluid for the wheel brakes and emergency gear extension if both pumps are lost.',
  }, mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10).rotateZ(Math.PI / 2).translate(X(SM(12.5)), -0.66, 0), F.steel()));
  for (const side of [1, -1]) {
    const z = side, S = side > 0 ? 'A' : 'B';
    const g = [];
    // pump → reservoir / manifold, then aft to the stabilator, rudder and nozzle area, outboard to the wing
    g.push(FR.pipe(inside([[SM(14.2), -0.42, z * 1.38], [SM(13.85), -0.6, z * 1.25], [SM(13.6), -0.66, z * 1.15], [SM(13.42), -0.71, z * 1.0], [SM(13.38), -0.72, z * 0.9], [SM(13.3), -0.74, z * 0.6], [SM(13.15), -0.74, z * 0.5], [SM(13.0), -0.74, z * 0.47]]), 0.016, 5, 24));
    // aft into the boom to the stabilator actuator, and up into the fin root to the rudder actuator
    g.push(FR.pipe([...inside([[SM(14.2), -0.42, z * 1.38], [SM(15.5), -0.35, z * 1.4], [SM(16.2), -0.26, z * 1.38]]), [15.0, -0.25, z * 1.45], [FR.STAB.pivotS - 0.95, -0.22, z * 1.6]], 0.016, 5, 24));
    { const [rs, ry, rz] = rudderAct(); g.push(FR.pipe([...inside([[SM(14.6), -0.35, z * 1.4], [12.9, 0.1, z * 1.44]]), [14.6, 0.15, z * finMid(0.15)], [15.1, 0.18, z * finMid(0.18)], [rs - 0.05, ry, z * rz]], 0.014, 5, 24)); }
    // out along the rear spar to the flaperon and aileron actuators (one actuator per surface)
    const fl = FR.teActuator('flaperon'), ai = FR.teActuator('aileron');
    g.push(FR.pipe([...inside([[SM(13.6), -0.66, z * 1.15], [SM(13.63), -0.56, z * 1.52], [SM(13.56), -0.3, z * 1.66], [SM(13.5), -0.12, z * 1.85]]), [WM(13.48), FR.wingY(2.3), z * 2.3], [WM(13.48), fl.y, z * (fl.z - 0.12)], [fl.s1 - 0.12, fl.y, z * (fl.z - 0.035)]], 0.014, 5, 30));
    g.push(FR.pipe([[WM(13.48), fl.y, z * (fl.z - 0.12)], [WM(13.48), FR.wingY(4.0), z * 4.0], [WM(13.47), FR.wingY(ai.z - 0.25), z * (ai.z - 0.25)], [ai.s1 - 0.03, ai.y, z * (ai.z - 0.03)]], 0.012, 5, 30));
    // forward inboard of the main-gear wheel bay, round the aft outboard corner of the weapons bay (between its aft
    // wall and the well) and along the bay sill (y −0.70) to the bay doors and launchers, then round the front of
    // the side bay, under the inlet duct and up outboard of it to the leading-edge-flap power drive unit
    g.push(FR.pipe([...inside([[SM(13.0), -0.74, z * 0.47], [SM(12.6), -0.73, z * 0.47], [SM(12.47), -0.72, z * 0.47], [SM(12.42), -0.715, z * 0.52], [SM(12.405), -0.71, z * 0.66], [SM(12.39), -0.705, z * 0.79], [SM(12.3), -0.7, z * 0.84], [SM(11.82), -0.7, z * 0.845], [SM(10.5), -0.7, z * 0.84], [SM(8.7), -0.7, z * 0.84], [SM(8.48), -0.66, z * 0.95], [SM(8.465), -0.6, z * 1.3], [SM(8.465), -0.47, z * 1.62], [7.6, -0.3, z * 1.7]]), ...toWingRoot(z), [lefPdu()[0] - 0.6, lefPdu()[1] - 0.03, z * (lefPdu()[2] - 0.1)], [lefPdu()[0] - 0.05, lefPdu()[1], z * (lefPdu()[2] - 0.08)]], 0.016, 5, 80));
    // crossfeed: each system also reaches the other side's stabilator and rudder actuators
    g.push(FR.pipe(inside([[SM(16.0), -0.3, z * 1.38], [SM(16.1), -0.55, z * 0.6], [SM(16.15), -0.58, -z * 0.6], [SM(16.25), -0.3, -z * 1.3]]), 0.012, 5));
    P(`Hydraulic lines (system ${S})`, {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi)', mass: 35,
      explode: [0, -0.6, 0.35 * side],
      desc: `System ${S} lines run from the ${side > 0 ? 'right' : 'left'} pumps to the stabilator, rudder, flaperon, aileron and leading-edge-flap actuators and the weapons-bay doors and launchers. The F-22 has two independent 4,000 psi systems but only one actuator on each control surface (Flight International, 1997); which system feeds which actuator is not published, so the crossfeed to the far tail is approximate.`,
    }, mesh(merge(g), F.hyd()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      // main gear: off the bay-sill gallery beside the well, up its inboard wall and across the roof to the
      // retraction actuator, a hose across the trunnion to the brake line on the strut, and a stub to the door jack
      g.push(FR.pipe([[SM(12.3), -0.7, side * 0.845], [SM(12.33), -0.6, side * 0.9], [SM(12.33), -0.36, side * 0.92], [SM(12.32), -0.305, side * 1.0], [SM(12.3), -0.305, side * 1.25], [SM(12.3), -0.345, side * 1.35]], 0.012, 5, 16));
      g.push(FR.pipe([[SM(11.88), -0.7, side * 0.845], [SM(11.91), -0.67, side * 0.95], [SM(11.93), -0.63, side * 1.04], [SM(11.935), -0.615, side * 1.09]], 0.01, 5));   // brake hose to the trunnion
      g.push(FR.pipe([[SM(12.6), -0.73, side * 0.47], [SM(12.56), -0.6, side * 0.5], [SM(12.535), -0.52, side * 0.56], [SM(12.53), -0.5, side * 0.6]], 0.01, 5));   // door jack
    }
    // nose gear: from the manifold beside the accumulators up behind the main bay's aft wall, forward above its
    // ceiling, down ahead of its front wall and under the cockpit to the nose-gear actuator and steering unit
    g.push(FR.pipe([[SM(12.5), -0.66, 0.0], [SM(12.42), -0.45, 0.07], [SM(12.38), -0.23, 0.08], [SM(12.2), -0.221, 0.08], [SM(8.6), -0.221, 0.08], [SM(8.44), -0.224, 0.1], [SM(8.41), -0.33, 0.16], [SM(8.4), -0.55, 0.17], [SM(7.9), -0.565, 0.155], [SM(7.4), -0.56, 0.125], [SM(7.0), -0.52, 0.15], [SM(5.8), -0.2, 0.2], [SM(4.6), -0.12, 0.08], [SM(4.36), -0.11, 0.02]], 0.012, 5, 80));
    P('Landing-gear & brake hydraulic lines', {
      system: 'Hydraulics', material: 'Titanium and steel tubing, flexible hoses across the gear pivots', mass: 18,
      explode: [0.3, -1.55, 0],
      desc: 'Utility lines to the gear actuators, door jacks, nose-wheel steering and wheel brakes: the main-gear lines branch off each system\'s gallery beside the well, the nose-gear line runs from the manifold beside the accumulators forward above the main bay; flexible hoses cross each trunnion (routing approximate).',
    }, mesh(merge(g), F.hyd()));
  }

  {
    // weapons branches off each system's bay-sill gallery: door drive, the three AVELs (hydropneumatic launchers;
    // how they draw on aircraft hydraulics is not published, so these stubs are approximate), the side-bay
    // trapeze and door, and the gun drive
    const g = [];
    for (const side of [1, -1]) {
      const z = side;
      g.push(FR.pipe([[SM(9.45), -0.7, z * 0.84], [SM(9.54), -0.735, z * 0.835], [SM(9.58), -0.75, z * 0.83]], 0.008, 5));          // door drive PDU
      // up outside the bay wall, along the sloping ceiling under the duct, into each AVEL hanger
      g.push(FR.pipe([[SM(10.9), -0.7, z * 0.84], [SM(10.95), -0.5, z * 0.82], [SM(11.0), -0.36, z * 0.72], [SM(11.05), -0.3, z * 0.6], [SM(11.05), -0.27, z * 0.4], [SM(11.05), -0.265, z * 0.2]], 0.007, 5, 24));
      for (const zz of [0.213, 0.373, 0.551]) g.push(FR.pipe([[SM(11.05), -0.27, z * zz], [SM(11.05), -0.24 - (zz > 0.55 ? 0.01 : 0) - 0.04, z * zz]], 0.006, 5, 2));
      // out under the duct to the side bay: trapeze actuator and door actuator
      g.push(FR.pipe([[SM(10.4), -0.7, z * 0.84], [SM(10.5), -0.45, z * 0.92], [SM(10.58), -0.4, z * 1.1]], 0.008, 5));
      g.push(FR.pipe([[SM(10.58), -0.4, z * 1.1], [SM(10.32), -0.415, z * 1.3], [SM(10.1), -0.4, z * 1.46], [SM(10.05), -0.39, z * 1.51]], 0.007, 5, 16));   // into the door actuator's roof fitting
    }
    // gun drive, from system A's gallery up the outboard side of the right duct
    g.push(FR.pipe([[SM(10.2), -0.7, 0.84], [SM(10.3), -0.44, 0.95], [SM(10.4), -0.42, 1.42], [SM(10.48), -0.18, 1.56], [SM(10.5), 0.0, 1.58]], 0.008, 5, 24));
    g.push(FR.pipe([[SM(10.25), -0.7, 0.86], [SM(10.35), -0.45, 0.97], [SM(10.45), -0.43, 1.45], [SM(10.55), -0.2, 1.58], [SM(10.58), 0.0, 1.6]], 0.008, 5, 24));
    P('Weapons hydraulic branch lines', {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi), swivel joints at the moving launchers', mass: 9, xrayWeight: 0.7,
      explode: [0.2, -1.75, 0.35],
      desc: 'Branches off the bay-sill galleries feed the main-bay door drives, the side-bay trapeze and door actuators, the M61A2 gun drive and stubs to the three AVELs on each side (the AVEL is hydropneumatic; how it draws on aircraft hydraulics is not published). The 4,000 psi system runs the rudders, landing gear, nose-wheel steering, flight controls and the weapons alike.',
    }, mesh(merge(g), F.hyd()));
  }

  // ================================================================== electrical
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    P(`Generator (${R})`, {
      system: 'Electrical', material: 'Brushless 270 V DC generator, oil cooled', mass: 40,
      explode: [0.45, -1.05, 1.05 * side],
      desc: 'Driven by the accessory drive, it supplies the 270 V DC primary bus. A high-voltage DC system saves copper weight; development-era figures give about 157 kW of primary and auxiliary electrical power in total.',
    }, mesh(merge([FR.cylX(SM(13.36), -0.42, side * 1.43, 0.22, 0.09, 0.09, 18), box(SM(13.27), -0.42, side * 1.43, 0.05, 0.15, 0.15)]), F.yellow()));
  }
  // auxiliary power generation system (AlliedSignal, now Honeywell; ≈ 120 kg in all): the G250 APU in the
  // left wing root between two wing spars, its inlet and exhaust behind flush doors, and the stored-energy
  // system whose air bottles start it, just ahead of it in the same wing root
  {
    const ax = SM(11.97), ay = -0.06, az = -1.70;
    const g = [FR.cylX(ax - 0.12, ay, az, 0.42, 0.13, 0.15, 20), FR.cylX(ax + 0.2, ay, az, 0.22, 0.15, 0.12, 20)];   // compressor / combustor / turbine
    g.push(FR.boxS(ax - 0.28, ay - 0.02, az + 0.06, 0.12, 0.2, 0.18));                                                   // gearbox and starter-generator pad
    g.push(FR.cylX(ax - 0.33, ay + 0.1, az + 0.09, 0.14, 0.05, 0.05, 12));                                             // air-turbine starter
    P('Auxiliary power unit (APU)', {
      system: 'Electrical', material: 'Honeywell (AlliedSignal) G250 gas turbine, 335 kW (450 hp)', mass: 70,
      explode: [0.2, 0.9, -1.3],
      desc: 'A 335 kW (450 hp) gas turbine in the left wing root that gives the F-22 autonomous ground starts and can restart the engines at subsonic speed up to 41,000 ft; the whole power system weighs about 120 kg. The F-22 uses an APU plus a stored-energy system, not an F-35-style integrated power package (envelope ≈ 0.7 × 0.3 m, estimate).',
    }, mesh(merge(g), F.boxLight()));
    // inlet: a flush door in the trunk wall just below the wing root, aft of the side bay, with a short duct
    // up and inboard into the compressor plenum; exhaust: a titanium duct up to a door in the upper skin
    const fIn = [0.31, 0.42], sIn = [SM(11.7), SM(11.8), SM(11.9)];
    const wallPt = (sv, f, inset = 0) => {
      const [zz, y] = FR.wallB(sv, f);
      const n = new THREE.Vector2(FR.bD(sv), -(FR.bW(sv) - FR.bWb(sv))).normalize();    // outward wall normal in (z, y)
      return [sv, y - n.y * inset, -(zz - n.x * inset)];
    };
    const fm = (fIn[0] + fIn[1]) / 2;
    const d = [rectTube([wallPt(SM(11.8), fm, 0.004), wallPt(SM(11.8), fm, 0.07), [SM(11.81), -0.24, az - 0.01], [SM(11.81), ay - 0.115, az]], 0.085, 0.17, { n: 8, up: [1, 0, 0] })];
    d.push(FR.pipe([[SM(12.32), ay, az], [SM(12.42), ay + 0.06, az + 0.01], [SM(12.5), FR.topAt(SM(12.5), 1.655) - 0.04, -1.655]], 0.065, 12, 8));
    P('APU inlet & exhaust ducts', {
      system: 'Electrical', material: 'Titanium exhaust duct, composite inlet duct', mass: 8,
      explode: [0.2, 1.3, -1.75],
      desc: 'A 450 hp turbine needs its own air: a short inlet duct from a flush door in the side of the fuselage just below the left wing root, and a titanium exhaust duct up through the upper skin of the wing root, where crews see its door open on the ground (positions approximate).',
    }, mesh(merge(d), F.tiDull()));
    const dIn = slab(toothedGrid((sv, u) => { const [zz, y] = FR.wallB(sv, lerp(fIn[0], fIn[1], u)); return [X(sv), y, -(zz + 0.003)]; }, sIn, { width: 0.12 }), () => [0, 0.008, 0.02], V(0, -0.4, -1));
    const dEx = slab(toothedGrid((sv, u) => { const zz = -lerp(1.57, 1.74, u); return [X(sv), FR.topAt(sv, Math.abs(zz)) + 0.003, zz]; }, [SM(12.4), SM(12.5), SM(12.6)], { width: 0.17 }), () => [0, -0.015, 0], V(0, 1, 0));
    P('APU inlet & exhaust doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite flush doors, saw-tooth edges', mass: 3, count: 2,
      explode: [0.2, 1.75, -2.05],
      desc: 'Flush doors keep both APU openings closed, and stealthy, except while the APU runs: the inlet door in the fuselage side below the left wing root, the exhaust door in the upper skin of the wing root (positions approximate).',
    }, mesh(merge([dIn, dEx]), F.door()));
    // stored-energy system: two high-pressure air bottles stacked inside the wing-root envelope ahead of the
    // APU, a start / control valve behind them and a line to the APU's air-turbine starter
    const b = [];
    const bs = SM(10.96), bz = -1.645, by = [-0.165, -0.01];   // the upper bottle stays under the refuelling manifold's wing branch
    for (const y of by) b.push(new THREE.CapsuleGeometry(0.075, 0.37, 4, 14).rotateZ(Math.PI / 2).translate(X(bs), y, bz));
    b.push(FR.boxS(SM(11.26), -0.06, -1.58, 0.06, 0.08, 0.08));                                                               // start / control valve
    const l = [FR.pipe([[SM(11.2), by[0], bz], [SM(11.235), -0.13, -1.62], [SM(11.255), -0.085, -1.595]], 0.014, 6, 4), FR.pipe([[SM(11.2), by[1], bz], [SM(11.235), -0.02, -1.62], [SM(11.255), -0.04, -1.595]], 0.014, 6, 4)];
    l.push(FR.pipe([[SM(11.29), -0.05, -1.58], [SM(11.42), -0.01, -1.59], [SM(11.5), 0.03, -1.605], [SM(11.58), ay + 0.1, az + 0.09]], 0.016, 6, 8));
    P('Stored-energy system (SES)', {
      system: 'Electrical', material: 'High-pressure air bottles, start / control valve and line to the APU starter', mass: 30,
      explode: [0.6, -0.4, -2.0],
      desc: 'Two high-pressure air bottles just ahead of the APU in the left wing root. Their air spins the APU\'s starter, and the APU must be running before either engine can be started. In flight the 75 kW stored-energy system has to come on line within 5 s at any altitude, airspeed and attitude to keep the flight controls, hydraulics and computers alive if both engines fail (bottle positions approximate).',
    }, [mesh(merge(b), F.orange()), mesh(merge(l), F.pipe())]);
    const c = [FR.boxS(SM(10.35), -0.1, bz, 0.22, 0.14, 0.12), FR.cylX(SM(10.5), -0.1, bz, 0.08, 0.05, 0.05, 12)];
    c.push(FR.pipe([[SM(10.54), -0.1, bz], [SM(10.62), -0.12, bz], [SM(10.69), by[0] + 0.02, bz]], 0.012, 6, 4));
    P('SES air re-charge compressor', {
      system: 'Electrical', material: 'Electrically driven high-pressure air compressor', mass: 12,
      explode: [0.9, -0.7, -1.75],
      desc: 'Just ahead of the bottles, it refills the stored-energy air bottles on board, part of the plan to make the F-22 independent of ground carts for starting and servicing.',
    }, mesh(merge(c), F.boxLight()));
    // start path from the APU to both AMADs (drawn as ducting; the actual drive arrangement is not published):
    // aft over the left main-gear well, down outboard of its cut-off aft corner and under the generator to the
    // left AMAD; from there across under both engines' gearboxes to the right one
    const sp = [FR.pipe([[SM(12.2), ay - 0.12, az], [SM(12.42), -0.235, -1.735], [SM(12.9), -0.245, -1.735], [SM(13.15), -0.26, -1.72], [SM(13.3), -0.45, -1.6], [SM(13.4), -0.64, -1.42], [SM(13.55), -0.6, -1.39], [SM(13.66), -0.53, -1.38]], 0.035, 8, 30)];
    sp.push(FR.pipe([[SM(13.7), -0.53, -1.38], [SM(13.72), -0.66, -1.2], [SM(13.75), -0.76, -0.95], [SM(13.75), -0.765, 0.0], [SM(13.75), -0.76, 0.95], [SM(13.72), -0.66, 1.2], [SM(13.7), -0.53, 1.38]], 0.02, 8, 36));
    P('APU start path to AMADs', {
      system: 'Electrical', material: 'Start ducting (arrangement not published; route approximate)', mass: 10,
      explode: [-0.2, -1.45, 0],
      desc: 'The APU\'s output reaches each airframe-mounted accessory drive to spin that engine up for a start, on the ground or in flight up to 41,000 ft. Whether the F-22 does this through a shaft or with starter air is not published, so this run only shows the connection.',
    }, mesh(merge(sp), F.tiDull()));
  }
  P('Batteries', {
    system: 'Electrical', material: 'Main and APU-start batteries', mass: 40, count: 2,
    explode: [0.4, -0.9, -0.6],
    desc: 'Batteries power the APU start and hold essential systems for a short time if all generation is lost.',
  }, mesh(merge([box(SM(6.5), -0.55, 0.5, 0.3, 0.16, 0.22), box(SM(6.5), -0.55, -0.5, 0.3, 0.16, 0.22)]), F.box()));
  P('Aft power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers and contactors', mass: 30, count: 2,
    explode: [-0.4, -1.05, 0],
    desc: 'Beside the keel ahead of the engine bays, they take each generator\'s 270 V DC output, switch it onto the buses and protect the aft loads (location approximate).',
  }, mesh(merge([box(SM(13.8), -0.62, 0.1, 0.4, 0.12, 0.1), box(SM(13.8), -0.62, -0.1, 0.4, 0.12, 0.1)]), F.box()));
  P('Forward power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers, circuit-breaker-free', mass: 40, count: 2,
    explode: [0.5, -0.65, 0],
    desc: 'Under the cockpit floor, they feed the avionics, cockpit and forward loads; solid-state controllers replace most circuit breakers and can reset a fault from the cockpit.',
  }, mesh(merge([box(SM(5.6), -0.27, 0.42, 0.6, 0.2, 0.12), box(SM(5.6), -0.27, -0.42, 0.6, 0.2, 0.12)]), F.box()));
  P('Converter-regulators (270 V → 28 V DC)', {
    system: 'Electrical', material: 'Solid-state DC–DC converters', mass: 20, count: 2,
    explode: [0.6, -1.2, 0.5],
    desc: 'Step the 270 V DC primary power down to 28 V DC for the many standard-voltage loads (lights, valves, older equipment); inverters supply the few AC loads.',
  }, mesh(merge([box(SM(6.15), -0.32, 0.42, 0.24, 0.18, 0.11), box(SM(6.15), -0.32, -0.42, 0.24, 0.18, 0.11)]), F.boxLight()));
  {
    const g = [];
    for (const z of [1, -1]) {
      // between the main-bay ceiling and F-2, stepping inboard where the duct turns in toward its engine, then
      // down behind the bay's aft wall and under F-3 to the aft distribution centre
      g.push(FR.pipe([[SM(3.0), -0.2, z * 0.25], [SM(5.0), -0.3, z * 0.36], [SM(6.3), -0.3, z * 0.48], [SM(6.9), -0.47, z * 0.52], [SM(7.5), -0.525, z * 0.55], [SM(8.1), -0.53, z * 0.66], [SM(8.36), -0.51, z * 0.745], [SM(8.43), -0.4, z * 0.745], [SM(8.5), -0.33, z * 0.73], [SM(8.7), -0.25, z * 0.66], [SM(9.0), -0.221, z * 0.62], [SM(11.0), -0.221, z * 0.6], [SM(11.8), -0.221, z * 0.45], [SM(12.34), -0.221, z * 0.35], [SM(12.37), -0.25, z * 0.34], [SM(12.41), -0.37, z * 0.33], [SM(12.45), -0.415, z * 0.31], [SM(12.55), -0.44, z * 0.29], [SM(12.9), -0.47, z * 0.25], [SM(13.6), -0.6, z * 0.12]], 0.018, 6, 80));
      g.push(FR.pipe([[SM(13.4), -0.36, z * 1.45], [SM(13.5), -0.27, z * 1.52], [SM(14.0), -0.26, z * 1.52], [SM(14.45), -0.3, z * 1.53], [SM(14.6), -0.55, z * 1.46], [SM(14.62), -0.709, z * 1.1], [SM(14.62), -0.709, z * 0.4], [SM(14.62), -0.64, z * 0.16]], 0.012, 6, 24));   // generator feeders, aft round the AMAD and in under the engine
      g.push(FR.pipe([[SM(13.9), -0.6, z * 0.12], [SM(15.5), -0.6, z * 0.12], [SM(16.2), -0.4, z * 0.15]], 0.016, 5));             // aft loads
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
    const vb = [];
    for (const side of [1, -1]) {
      const ez = FR.ENG_Z * side, ey = FR.ENG_Y;
      // forward inboard of the main-gear wheel bay, round the weapons bay's aft outboard corner and along its sill
      g.push(FR.pipe([[SM(14.55), -0.6, side * 0.42], [SM(14.42), -0.61, side * 0.45], [SM(13.95), -0.62, side * 0.51], [SM(13.86), -0.645, side * 0.45], [SM(13.7), -0.66, side * 0.44], [SM(13.45), -0.65, side * 0.45], [SM(13.2), -0.56, side * 0.45], [SM(12.9), -0.54, side * 0.45], [SM(12.55), -0.53, side * 0.45], [SM(12.45), -0.525, side * 0.46], [SM(12.408), -0.52, side * 0.55], [SM(12.405), -0.52, side * 0.69], [SM(12.398), -0.52, side * 0.805], [SM(12.31), -0.52, side * 0.835], [SM(11.9), -0.52, side * 0.83], [SM(8.6), -0.52, side * 0.83], [SM(7.6), -0.485, side * 0.55], [SM(6.6), -0.48, side * 0.3]], 0.03, 8, 90));       // between F-1 and the fuel–PAO exchangers
      // bleed port: from the HP compressor case (r ≈ 0.3) out through the bypass duct to the valve
      const dir = new THREE.Vector2(side * 0.42 - ez, -0.6 - ey).normalize();
      g.push(FR.pipe([[SM(14.5), ey + dir.y * 0.3, ez + dir.x * 0.3], [SM(14.52), ey + dir.y * 0.48, ez + dir.x * 0.48], [SM(14.55), -0.6, side * 0.42]], 0.028, 8, 6));
      // shut-off valve at the engine, pressure-regulating valve just forward of it
      vb.push(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 14).rotateZ(Math.PI / 2).translate(X(SM(14.42)), -0.61, side * 0.45));
      vb.push(FR.boxS(SM(14.42), -0.54, side * 0.45, 0.07, 0.06, 0.06));
      vb.push(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 14).rotateZ(Math.PI / 2).translate(X(SM(13.95)), -0.62, side * 0.51));
      vb.push(FR.boxS(SM(13.95), -0.55, side * 0.51, 0.06, 0.06, 0.06));
    }
    // conditioned air to the OBOGS concentrator and inert-gas generator, tapped after the air-cycle machine
    g.push(FR.pipe([[SM(6.62), -0.42, 0.06], [SM(6.66), -0.25, -0.2], [SM(6.64), -0.05, -0.38], [SM(6.6), 0.02, -0.42]], 0.016, 6, 10));
    P('Engine bleed-air ducts', {
      system: 'Environmental control', material: 'Insulated titanium ducting', mass: 30,
      explode: [0.2, -1.05, 0],
      desc: 'Hot, high-pressure air tapped through a port in each engine\'s HP compressor case runs forward to the air-cycle pack for cockpit pressurisation and cooling, the OBOGS and the inert-gas generator (routing approximate).',
    }, mesh(merge(g), F.tiDull()));
    P('Bleed-air shut-off & regulating valves', {
      system: 'Environmental control', material: 'Electrically controlled, pneumatically actuated butterfly valves', mass: 12, count: 4,
      explode: [-0.2, -1.5, 0],
      desc: 'At each engine a shut-off valve can isolate the bleed in a fire or a duct leak, and a pressure-regulating valve just forward of it drops the pressure to what the ECS can use (valve positions approximate).',
    }, mesh(merge(vb), F.steel()));
    P('ECS heat exchangers', {
      system: 'Environmental control', material: 'Aluminium plate-fin cores, fuel- and ram-air cooled', mass: 45, count: 2,
      explode: [0.4, -1.3, -0.4],
      desc: 'Bleed air is first cooled in heat exchangers; with so few cooling inlets on a stealthy airframe, much of the heat goes into the fuel rather than into ram air.',
    }, mesh(merge([box(SM(6.05), -0.42, 0.22, 0.32, 0.26, 0.24), box(SM(6.05), -0.42, -0.22, 0.32, 0.26, 0.24)]), F.copper()));
    P('Air-cycle machine & water separator', {
      system: 'Environmental control', material: 'Turbine / compressor air-cycle machine, water separator', mass: 55,
      explode: [0.4, -1.5, 0],
      desc: 'Expanding the cooled bleed air through a turbine drops its temperature far below ambient; a water separator dries it before it goes to the cockpit and the air-cooled avionics (position approximate).',
    }, mesh(merge([FR.cylX(SM(6.45), -0.45, 0, 0.36, 0.13, 0.11, 18), FR.cylX(SM(6.7), -0.45, 0, 0.14, 0.08, 0.08, 14)]), F.boxLight()));
    const d = [];
    for (const side of [1, -1]) d.push(FR.pipe([[SM(6.3), -0.4, side * 0.08], [SM(6.4), -0.15, side * 0.3], [SM(6.2), 0.05, side * 0.44], [SM(5.4), 0.05, side * 0.44]], 0.035, 8));
    d.push(FR.pipe([[SM(6.25), -0.45, 0], [SM(5.0), -0.12, 0.3], [SM(4.0), -0.1, 0.3], [SM(3.3), -0.05, 0.36]], 0.03, 8));
    {
      const v = [new THREE.CylinderGeometry(0.075, 0.075, 0.06, 18).rotateZ(Math.PI / 2).translate(X(SM(6.94)), 0.1, 0.3)];
      v.push(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14).rotateZ(Math.PI / 2).translate(X(SM(6.94)), 0.1, -0.3));
      v.push(FR.boxS(SM(6.95), 0.0, -0.3, 0.05, 0.08, 0.07));
      // canopy-seal air: from the regulator up the bulkhead to the sill
      const l = [FR.pipe([[SM(6.94), 0.06, -0.3], [SM(6.85), 0.3, -0.38], [SM(6.7), FR.upperA(SM(6.7), FR.sillW(SM(6.7))) - 0.04, -(FR.sillW(SM(6.7)) - 0.03)]], 0.008, 5, 8)];
      P('Cockpit pressure regulator & outflow valve', {
        system: 'Environmental control', material: 'Pressure-regulating outflow valve, safety valve, canopy-seal pressure regulator', mass: 6,
        explode: [-0.6, 1.0, 0],
        desc: 'Conditioned air flows into the cockpit and out through this outflow valve on the aft pressure bulkhead, which opens and closes to hold the cabin-pressure schedule; a regulator beside it feeds air to inflate the canopy seal against the sill (positions approximate).',
      }, [mesh(merge(v), F.boxLight()), mesh(merge(l), F.pipe())]);
    }
    P('Cockpit & avionics air ducts', {
      system: 'Environmental control', material: 'Composite and aluminium ducting', mass: 15,
      explode: [0.5, -0.4, 0.2],
      desc: 'Carry conditioned air to the cockpit outlets, the canopy demist and the forward avionics bay, and keep the cockpit pressurised.',
    }, mesh(merge(d), F.duct()));
  }
  P('OBOGS oxygen concentrator', {
    system: 'Environmental control', material: 'Molecular-sieve oxygen concentrator', mass: 18,
    explode: [0.2, 1.05, -0.6],
    desc: 'The on-board oxygen generation system passes conditioned engine bleed air through molecular-sieve beds that hold back nitrogen, giving the pilot breathing oxygen without liquid-oxygen servicing. Its product gas goes to the BRAG valve on the seat.',
  }, mesh(box(SM(6.6), 0.12, -0.42, 0.24, 0.22, 0.16), F.boxLight()));
  {
    // fire protection: extinguisher bottles ahead of the engine bays, with spray lines into each bay
    const g = [];
    for (const z of [0.11, -0.11]) g.push(new THREE.SphereGeometry(0.08, 14, 10).translate(X(SM(13.45)), 0.36, z));
    const l = [];
    for (const side of [1, -1]) {
      l.push(FR.pipe([[SM(13.45), 0.36, side * 0.18], [SM(13.7), 0.5, side * 0.35], [SM(14.5), 0.55, side * 0.42], [SM(16.0), 0.5, side * 0.42]], 0.01, 5));
      l.push(FR.pipe([[SM(14.0), 0.53, side * 0.4], [SM(14.2), 0.45, side * 1.2], [SM(14.4), 0.2, side * 1.36]], 0.008, 5));
    }
    const dl = [];
    for (const side of [1, -1]) {
      const ez = FR.ENG_Z * side;
      const yT = (s, z) => Math.min(0.5, FR.topAt(s, Math.abs(z)) - 0.07), yB = (s) => Math.max(-0.6, -FR.bD(s) + 0.07);
      for (const dz of [0.6, -0.6]) {
        dl.push(FR.pipe([SM(13.45), SM(14.6), SM(15.8), SM(17.05)].map((s) => [s, yT(s, ez + dz), ez + dz]), 0.006, 5, 16));
        dl.push(FR.pipe([SM(13.45), SM(14.6), SM(15.8), SM(17.05)].map((s) => [s, yB(s), ez + dz]), 0.006, 5, 16));
      }
      for (const s of [SM(13.45), SM(17.05)]) dl.push(FR.pipe([[s, yT(s, ez - 0.6), ez - 0.6], [s, yT(s, ez), ez], [s, yT(s, ez + 0.6), ez + 0.6]], 0.006, 5, 10), FR.pipe([[s, yB(s), ez - 0.6], [s, yB(s), ez], [s, yB(s), ez + 0.6]], 0.006, 5, 10));
    }
    P('Engine-bay fire detector loops', {
      system: 'Environmental control', material: 'Continuous-element fire / overheat sensing loops on clips', mass: 4, xrayWeight: 0.7,
      explode: [-0.5, 2.05, 0],
      desc: 'Sensing elements run along the top and bottom of each engine bay: their resistance changes with temperature, so a fire or a hot-air leak anywhere along them raises a warning in the cockpit. Kidde-Graviner, a fire-protection specialist, is on the F-22 supplier list (routing approximate).',
    }, mesh(merge(dl), F.wireOrange()));
    P('Engine-bay fire extinguishers', {
      system: 'Environmental control', material: 'Pressurised extinguishing-agent bottles and spray tubes', mass: 22, count: 2,
      explode: [-0.3, 1.55, 0],
      desc: 'When the detector loops warn of a fire, the pilot shuts off that engine\'s fuel and fires one or both bottles, which flood the bay through spray tubes (agent and positions approximate).',
    }, [mesh(merge(g), F.red()), mesh(merge(l), F.pipe())]);
    const d = [];
    for (const side of [1, -1]) for (const s of [SM(9.2), SM(10.3)]) d.push(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8).rotateZ(Math.PI / 2).translate(X(s), FR.topAt(s, 1.65) - 0.075, side * 1.65));
    P('Dry-bay fire suppression', {
      system: 'Environmental control', material: 'Fast-acting suppressant canisters with optical fire detectors', mass: 10, count: 4,
      explode: [0, 1.75, 0.5],
      desc: 'Small canisters in the dry bays around the fuel tanks and inlet ducts fire within milliseconds of an optical sensor seeing a flash from a hit, smothering a fire before it can grow (positions approximate).',
    }, mesh(merge(d), F.orange()));
  }
  return { tanks };
}
