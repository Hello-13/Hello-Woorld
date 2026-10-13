// F-22A airframe: fuselage skins by section, primary structure (frames, titanium bulkheads,
// longerons, keel, EB-welded booms), wings with their multi-spar boxes, all-moving stabilators,
// canted vertical tails and every wing/tail control surface with its actuators.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { wingPanel, wingPoint, mirrorZ, naca00 } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, dedupe, frameBand, platePoly, slab, hinge, ribPlate, sparWeb } from './util.js';

const { X, P3, lerp, DEG } = FR;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Sorted station list from s0 to s1 with roughly `step` spacing that includes every `must`. */
export function stations(s0, s1, step, must = []) {
  const out = new Set([s0, s1, ...must.filter((m) => m > s0 && m < s1)]);
  const n = Math.ceil((s1 - s0) / step);
  for (let k = 1; k < n; k++) {
    const s = s0 + ((s1 - s0) * k) / n;
    if (must.every((m) => Math.abs(m - s) > step * 0.3)) out.add(s);
  }
  return [...out].sort((a, b) => a - b);
}
const inRange = (s0, s1, r) => s0 >= r.s0 - 1e-6 && s1 <= r.s1 + 1e-6;
const zy = (pts) => dedupe(pts.map((p) => [p[2], p[1]]));

/** Clip a closed polygon to y ≤ ymax (Sutherland–Hodgman). */
function clipBelow(poly, ymax) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ain = a[1] <= ymax, bin = b[1] <= ymax;
    if (ain) out.push(a);
    if (ain !== bin) { const t = (ymax - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, ymax]); }
  }
  return out;
}

/** Fan cap over a ring (facing aft). */
function capAft(ring) {
  const c = [0, 0, 0];
  for (const p of ring) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  c.forEach((v, i) => { c[i] = v / ring.length; });
  const pos = [...c], idx = [];
  for (const p of ring) pos.push(...p);
  for (let k = 0; k < ring.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % ring.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const n = new THREE.Vector3(...pos.slice(3, 6)).sub(new THREE.Vector3(...c)).cross(new THREE.Vector3(...pos.slice(6, 9)).sub(new THREE.Vector3(...c)));
  if (n.x > 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Open-sided cavity (bay / well liner): `edge(s)` gives the two opening edge points and
 * `inward(s)` the depth direction. Returns walls, back and end caps.
 */
export function cavity(st, edge, inward, depth) {
  const grid = st.map((s) => {
    const [a, b] = edge(s);
    const d = inward(s).map((v) => v * depth);
    return [a, [a[0] + d[0], a[1] + d[1], a[2] + d[2]], [b[0] + d[0], b[1] + d[1], b[2] + d[2]], b];
  });
  const pos = [], idx = [];
  const m = grid.length;
  for (const row of grid) for (const p of row) pos.push(...p);
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < 3; c++) {
      const a = r * 4 + c, b = a + 1, cc = a + 4, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  for (const r of [0, m - 1]) idx.push(r * 4, r * 4 + 1, r * 4 + 2, r * 4, r * 4 + 2, r * 4 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildAirframe(ctx) {
  const { P, anim } = ctx;

  // ================================================================== fuselage A (nose → s 8.4)
  const sA = stations(0, FR.S_AB, 0.13, [0.05, 0.12, 0.22, 0.35, 0.5, 0.7, 0.95, 1.25, 1.6, 2.0, 2.55, FR.HOLE_S0, FR.HOLE_S1, FR.NOSE_WELL.s0, FR.NOSE_WELL.s1]);
  const ringsA = sA.map((s) => FR.ringA(s).pts);
  const HA = FR.ringA(1).half;           // points in one half (25)
  const mirA = (j) => (j < HA - 1 ? j : 2 * HA - 3 - j);
  const keepA = (st) => (i, j) => {
    const q = mirA(j), s0 = st[i], s1 = st[i + 1];
    if (q < 5 && s0 >= FR.HOLE_S0 - 1e-6 && s1 <= FR.HOLE_S1 + 1e-6) return false;
    if (q >= 21 && q <= 23 && inRange(s0, s1, FR.NOSE_WELL)) return false;
    return true;
  };
  const iR = sA.indexOf(2.55);
  const radome = P('Radome', {
    system: 'Skin & fairings', skin: true, material: 'Quartz / cyanate-ester composite shell with frequency-selective layers',
    mass: 95, explode: [3.4, 0.2, 0], temp: 288,
    desc: 'A 2.5 m faceted composite cone over the radar. It is built as a frequency-selective surface: transparent in the AN/APG-77\'s own X band, reflective outside it, so it adds almost nothing to the radar cross-section.',
  }, mesh(FR.gridSurface(ringsA.slice(0, iR + 1), { closed: true }), F.skin()));
  radome.userData.part.thermalRole = 'stagnation';

  const stF = sA.slice(iR);
  P('Forward fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Composite and aluminium panels with RAM coatings',
    mass: 320, explode: [1.3, 0.75, 0],
    desc: 'Skins the cockpit section from the radar bulkhead to the inlets. The chine along each side is a sharp edge set at the same plan-view angle as the wing leading edge, so it reflects radar into the same few directions.',
  }, mesh(FR.gridSurface(ringsA.slice(iR), { closed: true, keep: keepA(stF) }), F.skin()));

  // ================================================================== fuselage B (s 8.4 → 17.55)
  const bMust = [FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, FR.MAIN_BAY.s0, FR.MAIN_BAY.s1, FR.MAIN_WELL.s0, FR.MAIN_WELL.s1, 13.2];
  const sB = stations(FR.S_AB, FR.S_B_END, 0.15, bMust);
  ctx.sB = sB;
  const ringsB = sB.map((s) => FR.ringB(s).pts);
  const HB = FR.ringB(10).half;           // 37
  const mirB = (j) => (j < HB - 1 ? j : 2 * HB - 3 - j);
  const keepB = (st, upper) => (i, j) => {
    const q = mirB(j), s0 = st[i], s1 = st[i + 1];
    if (upper !== (q <= 16)) return false;
    if (q >= 32 && inRange(s0, s1, FR.MAIN_BAY)) return false;
    if (q >= 28 && q <= 30 && inRange(s0, s1, FR.MAIN_WELL)) return false;
    if (q >= 21 && q <= 23 && inRange(s0, s1, FR.SIDE_BAY)) return false;
    return true;
  };
  const iM = sB.indexOf(13.2);
  const stM = sB.slice(0, iM + 1), stAft = sB.slice(iM);
  const rM = ringsB.slice(0, iM + 1), rAft = ringsB.slice(iM);
  P('Mid-fuselage upper skin', {
    system: 'Skin & fairings', skin: true, material: 'Bismaleimide (BMI) composite panels, RAM coated',
    mass: 260, explode: [0, 1.5, 0],
    desc: 'The broad upper deck over the inlet ducts and fuselage tanks, blending into the wing glove. Thermoset composites make up about a quarter of the F-22\'s structural weight.',
  }, mesh(FR.gridSurface(rM, { closed: true, keep: keepB(stM, true) }), F.skin()));
  P('Intake trunk & lower fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Composite and titanium panels, RAM coated',
    mass: 300, explode: [0, -1.25, 0],
    desc: 'Wraps the intake trunks and the belly. The openings for the main weapons bay, both side bays and the main-gear wells are cut here; their doors close flush with saw-toothed edges.',
  }, mesh(FR.gridSurface(rM, { closed: true, keep: keepB(stM, false) }), F.skin()));
  P('Aft fuselage upper skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium and high-temperature composite panels, engine-bay access doors',
    mass: 230, explode: [-0.6, 1.5, 0],
    desc: 'Covers the engine bays between the vertical tails. Large access doors over each F119 let the engine be changed from below in a few hours.',
  }, mesh(FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, true) }), F.skin()));
  P('Aft fuselage lower skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium panels (hot structure near the nozzles)',
    mass: 210, explode: [-0.6, -1.3, 0],
    desc: 'The underside of the engine bays and the aft closure around the nozzles. Titanium is used where exhaust heat would soften aluminium or composites.',
  }, [mesh(FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, false) }), F.skin()), mesh(capAft(rAft[rAft.length - 1]), F.black())]);

  // ================================================================== primary structure
  // forward fuselage: radar bulkhead, cockpit bulkheads and U-frames around the cockpit
  {
    const g = [];
    g.push(platePoly(2.55, zy(FR.ringA(2.55).pts), 0.03));
    g.push(platePoly(3.62, clipBelow(zy(FR.ringA(3.62).pts), 0.28), 0.025));
    g.push(platePoly(7.0, zy(FR.ringA(7.0).pts), 0.025));
    for (const s of [3.1, 4.3, 5.0, 5.7, 6.4, 7.7]) {
      const ys = FR.upperA(s, FR.sillW(s)) - 0.05;
      const cut = s > FR.HOLE_S0 && s < FR.HOLE_S1;
      g.push(frameBand(s, zy(FR.ringA(s).pts), { depth: 0.07, thick: 0.03, keep: cut ? (p) => p[1] < ys || Math.abs(p[0]) > FR.sillW(s) + 0.06 : null }));
    }
    P('Forward fuselage frames & bulkheads', {
      system: 'Structure', material: 'Aluminium and titanium machined frames', mass: 410, explode: [1.7, 0.4, 0],
      desc: 'The radar bulkhead at the front carries the AN/APG-77 array; behind it the forward and aft cockpit bulkheads close the pressurised cockpit and U-shaped frames pass under the canopy sills. Built by Lockheed Martin at Marietta.',
    }, mesh(merge(g), F.alu()));
  }
  // mid fuselage: machined titanium bulkheads that carry the wing, bays and inlet ducts
  {
    const g = [];
    for (const s of [8.6, 9.6, 10.6, 11.6, 12.6]) {
      const D = FR.bD(s);
      const sideBay = s > FR.SIDE_BAY.s0 && s < FR.SIDE_BAY.s1;
      g.push(frameBand(s, zy(FR.ringB(s).pts), {
        depth: 0.15, thick: 0.05,
        keep: (p) => !(p[1] < -D + 0.12 && Math.abs(p[0]) < FR.MAIN_BAY.z + 0.05) && !(sideBay && p[1] < -0.38 && p[1] > -0.86 && Math.abs(p[0]) > 1.25),
      }));
    }
    P('Mid-fuselage titanium bulkheads', {
      system: 'Structure', material: 'Ti-6Al-4V bulkheads machined from large forgings', mass: 1150, explode: [0, 0.65, 0],
      desc: 'Five heavy bulkheads (count simplified) carry wing bending loads across the fuselage around the inlet ducts and over the main weapons bay. Titanium is about 39 % of the F-22\'s structural weight, more than any earlier US fighter.',
    }, mesh(merge(g), F.ti()));
  }
  // engine-bay frames
  {
    const g = [];
    for (const s of [13.4, 14.3, 15.2, 16.1, 17.0]) g.push(frameBand(s, zy(FR.ringB(s).pts), { depth: 0.1, thick: 0.04 }));
    P('Engine-bay frames', {
      system: 'Structure', material: 'Titanium frames', mass: 420, explode: [-1.0, 0.9, 0],
      desc: 'Hoop frames around the two engine bays tie the keel, the booms and the upper deck together and carry the vertical-tail and stabilator loads forward.',
    }, mesh(merge(g), F.tiDull()));
  }
  // keel and longerons
  {
    const g = [];
    const keel = [];
    for (let s = 12.6; s <= 17.45; s += 0.25) keel.push(s);
    // keel web between the engines
    const grid = [keel.map((s) => [X(s), FR.topAt(s, 0) - 0.06, 0]), keel.map((s) => [X(s), -FR.bD(s) + 0.05, 0])];
    g.push(slab([grid[0].map((p) => [p[0], p[1], -0.02]), grid[1].map((p) => [p[0], p[1], -0.02])], () => [0, 0, 0.04]));
    // weapons-bay longerons along the door edges and the bay ceiling
    for (const z of [-0.81, 0.81]) {
      g.push(FR.pipe([[8.0, -0.86, z], [10, -0.88, z], [12.6, -0.87, z], [13.6, -0.8, z]], 0.035, 6));
      g.push(FR.pipe([[8.3, -0.24, z * 0.75], [12.4, -0.26, z * 0.75]], 0.03, 6));
    }
    P('Keel & weapons-bay longerons', {
      system: 'Structure', material: 'Titanium keel web, steel / titanium longerons', mass: 380, explode: [0, -0.45, 0],
      desc: 'Heavy longerons run along both edges of the main weapons bay, the largest cut-out in the airframe, and continue aft into the keel that separates the two engine bays and stops a fire spreading between them.',
    }, mesh(merge(g), F.ti()));
  }
  {
    const g = [];
    for (const side of [1, -1]) {
      const fwd = [];
      for (let s = 2.7; s <= 7.6; s += 0.35) {
        const z = Math.max(0.42, FR.sillW(s) + 0.07);
        fwd.push([s, FR.topAt(s, Math.min(z, FR.aW(s) - 0.05)) - 0.06, side * Math.min(z, FR.aW(s) - 0.05)]);
      }
      g.push(FR.pipe(fwd, 0.028, 6));
      const mid = [];
      for (let s = 7.6; s <= 17.4; s += 0.5) mid.push([s, FR.topAt(s, 0.45) - 0.06, side * 0.45]);
      g.push(FR.pipe(mid, 0.028, 6));
      const chine = [];
      for (let s = 2.7; s <= 8.2; s += 0.4) chine.push([s, FR.aYC(s) - 0.02, side * (FR.aW(s) - 0.06)]);
      g.push(FR.pipe(chine, 0.022, 6));
    }
    P('Upper longerons & canopy rails', {
      system: 'Structure', material: 'Titanium extrusions', mass: 140, explode: [0.4, 1.0, 0],
      desc: 'Continuous longerons along the cockpit sills (the canopy rails), the upper deck and the forward chines carry fuselage bending between the frames.',
    }, mesh(merge(g), F.tiDull()));
  }
  // EB-welded titanium aft booms with the boom-end fairings that carry the stabilator pivots
  for (const side of [1, -1]) {
    const g = [];
    const rings = [];
    for (const s of [12.8, 13.6, 14.6, 15.6, 16.6, 17.4]) rings.push(FR.superRing(X(s), side * 1.5, 0.05, 0.22, 0.5, 12, 6));
    g.push(FR.gridSurface(rings, { closed: true, uv: 'n' }));
    // boom-end fairing behind the fuselage: tapers to the stabilator trailing edge
    const fr = [];
    const keys = [[17.35, 1.485, 0.0, 0.31, 0.62], [17.6, 1.49, 0.0, 0.29, 0.58], [18.0, 1.5, -0.03, 0.26, 0.44], [18.35, 1.51, -0.06, 0.2, 0.3], [18.62, 1.52, -0.08, 0.1, 0.12]];
    for (const [s, z, y, w, h] of keys) fr.push(FR.superRing(X(s), side * z, y, w, h, 16, 3.4));
    const fairing = FR.gridSurface(fr, { closed: true, uv: 'n' });
    P(side > 0 ? 'Aft boom (right)' : 'Aft boom (left)', {
      system: 'Structure', material: 'Ti-6Al-4V, electron-beam welded (90+ pieces per ship set)', mass: 310,
      explode: [-1.9, 0.25, 1.15 * side],
      desc: 'Box-section titanium booms outboard of each engine carry the vertical tail and stabilator. Boeing\'s aft fuselage joins over 90 titanium pieces with about 3,600 in (91 m) of full-penetration electron-beam welds per ship set instead of fasteners.',
    }, [mesh(merge(g), F.ti()), mesh(fairing, F.skin())]);
  }

  // ================================================================== wings
  const wRoot = FR.wingSection(1.45), wTip = FR.wingSection(FR.WING.semi);
  const etaOf = (z) => (z - 1.45) / (FR.WING.semi - 1.45);
  const naca = naca00;
  for (const side of [1, -1]) {
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const R = side > 0 ? 'right' : 'left';
    const panel = (o) => flip(wingPanel({ root: wRoot, tip: wTip, n: 22, ...o }));
    const skin = [
      panel({ c0: 0.075, c1: 0.85, eta0: 0, eta1: 0.525, stations: 6 }),
      panel({ c0: 0.075, c1: 0.78, eta0: 0.525, eta1: 0.94, stations: 5 }),
      panel({ c0: 0.075, c1: 1, eta0: 0.94, eta1: 1, stations: 1 }),
      panel({ c0: 0, c1: 0.075, eta0: 0, eta1: 0.08, stations: 1 }),
      panel({ c0: 0, c1: 0.075, eta0: 0.97, eta1: 1, stations: 1 }),
      panel({ c0: 0.85, c1: 1, eta0: 0, eta1: 0.07, stations: 1 }),
      panel({ c0: 0.85, c1: 1, eta0: 0.52, eta1: 0.525, stations: 1 }),
      panel({ c0: 0.78, c1: 1, eta0: 0.525, eta1: 0.53, stations: 1 }),
    ];
    const wing = P(`Wing skin (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Bismaleimide composite skins, RAM-treated edges', mass: 420,
      explode: [0, 0.35, 2.7 * side], callout: false,
      desc: 'Upper and lower skins of a 42°-swept wing with a −17° trailing edge; 78.04 m² for both wings and a 13.56 m span. NACA 64A-series sections thin from 5.92 % at the root to 4.29 % at the tip, with 3.25° of anhedral.',
    }, skin.map((g) => mesh(g, F.wing())));
    wing.userData.part.thermalRole = 'leadingEdge';

    // control surfaces
    const surf = (name, info, o, c, toward, testCf) => {
      const geo = panel(o);
      const p0 = mz(wingPoint(wRoot, wTip, o.eta0, c)), p1 = mz(wingPoint(wRoot, wTip, o.eta1, c));
      const test = mz(wingPoint(wRoot, wTip, (o.eta0 + o.eta1) / 2, testCf));
      const h = hinge(mesh(geo, F.wing()), p0, p1, test, toward);
      const part = P(name, info, h.pivot);
      part.userData.part.thermalRole = info.thermal || null;
      return h;
    };
    const down = V(0, -1, 0);
    anim.lef.push({ side, h: surf(`Leading-edge flap (${R})`, {
      system: 'Flight controls', material: 'Composite over titanium torque tube', mass: 95, explode: [1.0, 0.1, 2.9 * side], thermal: 'leadingEdge',
      desc: 'Full-span flap along the leading edge, driven by rotary actuators. It droops automatically with angle of attack to keep the flow attached, extending usable lift toward the 60° angles of attack the F-22 can fly with thrust vectoring.',
    }, { c0: 0, c1: 0.075, eta0: 0.08, eta1: 0.97, stations: 6 }, 0.075, down, 0.0) });
    anim.flaperon.push({ side, h: surf(`Flaperon (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 120, explode: [-1.4, 0.15, 2.4 * side],
      desc: 'Inboard trailing-edge surface that works as a flap for take-off and landing and as an aileron for roll. With the ailerons and rudders it also serves as the speed brake — the F-22 has no separate airbrake panel.',
    }, { c0: 0.85, c1: 1, eta0: 0.07, eta1: 0.52, stations: 3 }, 0.85, down, 1) });
    anim.aileron.push({ side, h: surf(`Aileron (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 60, explode: [-1.2, 0.15, 3.3 * side],
      desc: 'Outboard trailing-edge surface for roll. The fly-by-wire system blends it with the flaperons, differential stabilators and, at low speed, the rudders.',
    }, { c0: 0.78, c1: 1, eta0: 0.53, eta1: 0.94, stations: 3 }, 0.78, down, 1) });

    // wing box: six spars and ribs (count illustrative), torque box between the hinge lines
    const spanEtas = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97];
    const secs = spanEtas.map((e) => {
      const z = 1.45 + e * (FR.WING.semi - 1.45);
      return FR.wingSection(z);
    });
    const box = [];
    for (const f of [0.1, 0.23, 0.36, 0.49, 0.62, 0.75]) box.push(sparWeb(secs, f, f === 0.1 || f === 0.75 ? 0.022 : 0.014, 0.9, naca));
    for (const sec of secs) box.push(ribPlate(sec, 0.1, 0.75, 0.014, 0.88, naca));
    // root attach lugs on the side of the fuselage
    for (const f of [0.1, 0.23, 0.36, 0.49, 0.62, 0.75]) {
      const x = wRoot.le[0] - f * wRoot.chord;
      box.push(new THREE.BoxGeometry(0.12, naca(f, wRoot.t) * wRoot.chord * 1.6, 0.22).translate(x, wRoot.le[1], 1.52));
    }
    const boxGeo = merge(box);
    P(`Wing box (${R})`, {
      system: 'Structure', material: 'Titanium and resin-transfer-moulded composite spars, composite ribs', mass: 900,
      explode: [0, -0.2, 2.2 * side], callout: side > 0, anchor: [X(10.6), 0.1, 3.4 * side],
      desc: 'A multi-spar torque box that carries the wing\'s bending and twisting loads and doubles as an integral fuel tank. Boeing built the wings, using titanium spars and some of the first resin-transfer-moulded composite spars in production.',
    }, mesh(side > 0 ? boxGeo : mirrorZ(boxGeo), F.composite()));

    // wing control actuators: LEF rotary actuators on a torque tube, flaperon and aileron actuators
    {
      const g = [];
      const lefA = mz(wingPoint(wRoot, wTip, 0.08, 0.085)), lefB = mz(wingPoint(wRoot, wTip, 0.96, 0.085));
      g.push(FR.pipe([[FR.SN - lefA.x, lefA.y, lefA.z], [FR.SN - lefB.x, lefB.y, lefB.z]], 0.025, 6, 4));
      for (const e of [0.15, 0.45, 0.75]) {
        const p = mz(wingPoint(wRoot, wTip, e, 0.09));
        g.push(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10).rotateX(Math.PI / 2).translate(p.x, p.y, p.z));
      }
      for (const [e, c, len] of [[0.16, 0.79, 0.55], [0.38, 0.79, 0.5], [0.66, 0.72, 0.42]]) {
        const p = mz(wingPoint(wRoot, wTip, e, c));
        g.push(new THREE.CylinderGeometry(0.045, 0.04, len, 10).rotateZ(Math.PI / 2).translate(p.x + len / 2 - 0.05, p.y, p.z));
      }
      P(`Wing control actuators (${R})`, {
        system: 'Flight controls', material: 'Steel / titanium hydraulic actuators, torque tube', mass: 85, explode: [-0.3, -0.7, 2.6 * side],
        desc: 'Rotary actuators turn the leading-edge flap through a torque tube along the front spar; linear 4,000 psi hydraulic actuators at the rear spar drive the flaperon and aileron (actuator count illustrative).',
      }, mesh(merge(g), F.hyd()));
    }

    // nav light lens and formation strip on the wing tip
    ctx.wingTips = ctx.wingTips || [];
    ctx.wingTips.push({ side, le: mz(new THREE.Vector3(wTip.le[0], wTip.le[1], wTip.le[2])), chord: wTip.chord });
  }

  // ================================================================== stabilators
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const sr = FR.stabSection(FR.STAB.rootZ), stp = FR.stabSection(FR.STAB.tipZ);
    const geo = flip(wingPanel({ root: sr, tip: stp, stations: 5, n: 20 }));
    const p0 = V(X(FR.STAB.pivotS), FR.STAB.y, 0), p1 = V(X(FR.STAB.pivotS), FR.STAB.y, side);
    const testTE = V(X(18.6), FR.STAB.y, side * 2.0);
    const h = hinge(mesh(geo, F.wing()), p0, p1, testTE, V(0, -1, 0));
    const stab = P(`Stabilator (${R})`, {
      system: 'Flight controls', material: 'Composite skins on a titanium torque box', mass: 290,
      explode: [-2.3, -0.2, 1.9 * side], callout: false,
      desc: 'All-moving horizontal tail (8.84 m span over both sides) for pitch control. Its edges repeat the wing\'s 42° and −17° sweeps; it also moves differentially to help roll at high angle of attack.',
    }, h.pivot);
    stab.userData.part.thermalRole = 'leadingEdge';
    anim.stab.push({ side, h });

    // torque box and spindle (rotates with the stabilator)
    const secs = [0, 0.33, 0.66, 0.95].map((e) => FR.stabSection(FR.STAB.rootZ + e * (FR.STAB.tipZ - FR.STAB.rootZ)));
    const g = [];
    for (const f of [0.15, 0.42, 0.7]) g.push(sparWeb(secs, f, 0.016, 0.88, naca00));
    for (const sec of secs) g.push(ribPlate(sec, 0.12, 0.75, 0.012, 0.86, naca00));
    const spindle = new THREE.CylinderGeometry(0.075, 0.075, 1.15, 16).rotateX(Math.PI / 2).translate(X(FR.STAB.pivotS), FR.STAB.y, 1.68);
    g.push(spindle);
    const boxGeo = merge(g);
    const hb = hinge(mesh(side > 0 ? boxGeo : mirrorZ(boxGeo), F.ti()), p0, p1, testTE, V(0, -1, 0));
    P(`Stabilator torque box & spindle (${R})`, {
      system: 'Structure', material: 'Titanium spindle and spars', mass: 110, explode: [-2.3, -0.2, 1.4 * side],
      desc: 'The whole stabilator turns on a single titanium spindle carried in bearings in the aft boom; spars and ribs inside spread the load into the composite skins.',
    }, hb.pivot);
    anim.stab.push({ side, h: hb });

    // actuator in the boom driving the spindle crank
    const act = [];
    act.push(new THREE.CylinderGeometry(0.075, 0.065, 0.9, 12).rotateZ(Math.PI / 2 - 0.25).translate(X(16.25), -0.24, side * 1.38));
    act.push(new THREE.BoxGeometry(0.12, 0.3, 0.1).translate(X(16.75), -0.15, side * 1.38));
    P(`Stabilator actuator (${R})`, {
      system: 'Flight controls', material: 'Dual-tandem hydraulic actuator, 4,000 psi', mass: 55, explode: [-1.6, -0.75, 1.25 * side],
      desc: 'A dual-tandem actuator fed by both hydraulic systems, so one system can fail and the stabilator still moves. It sits in the boom and drives a crank on the spindle.',
    }, mesh(merge(act), F.hyd()));
  }

  // ================================================================== vertical tails
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const T = FR.FIN;
    const vRoot = { le: [0, 0, 0], chord: T.rootC, t: 0.045 };
    const vTip = { le: [-T.span * Math.tan(T.sweep), 0, T.span], chord: T.tipC, t: 0.035 };
    const place = (part) => {
      part.position.set(X(T.rootS), T.rootY, side * T.rootZ);
      part.rotation.x = -Math.PI / 2 + T.cant * side;
      return part;
    };
    const fin = [
      wingPanel({ root: vRoot, tip: vTip, c0: 0, c1: 0.72, stations: 5 }),
      wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0, eta1: 0.06, stations: 1 }),
      wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0.66, eta1: 1, stations: 2 }),
    ];
    const vt = place(P(`Vertical tail (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Composite skins, RAM-treated edges', mass: 230,
      explode: [-0.9, 2.0, 1.1 * side], callout: side > 0, anchor: [-1.6, 0.1, 2.3],
      desc: 'Each fin is canted 28° outward so neither presents a flat, vertical surface to a radar looking from the side. Together the two give about 16.5 m² of vertical tail area.',
    }, fin.map((g) => mesh(g, F.wing()))));
    vt.userData.part.thermalRole = 'leadingEdge';

    const rud = wingPanel({ root: vRoot, tip: vTip, c0: 0.72, c1: 1, eta0: 0.06, eta1: 0.66, stations: 3 });
    const h = hinge(mesh(rud, F.wing()), wingPoint(vRoot, vTip, 0.06, 0.72), wingPoint(vRoot, vTip, 0.66, 0.72),
      wingPoint(vRoot, vTip, 0.36, 1.0), V(0, -1, 0));
    place(P(`Rudder (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 45, explode: [-1.5, 2.1, 1.45 * side],
      desc: 'Rudders on the lower two-thirds of each fin trailing edge yaw the jet; deflected outward together they also act as part of the speed brake.',
    }, h.pivot));
    anim.rudder.push({ side, h });

    const secs = [0, 0.33, 0.66, 0.95].map((e) => {
      const le = [lerp(vRoot.le[0], vTip.le[0], e), 0, lerp(0, T.span, e)];
      return { le, chord: lerp(T.rootC, T.tipC, e), t: lerp(0.045, 0.035, e) };
    });
    const g = [];
    for (const f of [0.12, 0.4, 0.68]) g.push(sparWeb(secs, f, 0.016, 0.88, naca00));
    for (const sec of secs) g.push(ribPlate(sec, 0.12, 0.68, 0.012, 0.86, naca00));
    place(P(`Fin box (${R})`, {
      system: 'Structure', material: 'Composite spars and ribs, titanium root fittings', mass: 140, explode: [-0.9, 1.4, 0.75 * side],
      desc: 'Three spars and ribs make each fin a stiff torque box, bolted at its root to the aft boom.',
    }, mesh(merge(g), F.composite())));

    const act = [new THREE.CylinderGeometry(0.05, 0.045, 0.6, 10).translate(-T.rootC * 0.74, 0, 0.32)];
    act.push(new THREE.BoxGeometry(0.18, 0.08, 0.16).translate(-T.rootC * 0.74, 0, 0.05));
    place(P(`Rudder actuator (${R})`, {
      system: 'Flight controls', material: 'Hydraulic actuator in the fin root', mass: 25, explode: [-1.4, 1.2, 1.0 * side],
      desc: 'A compact hydraulic actuator at the base of the fin drives the rudder through its lower hinge.',
    }, mesh(merge(act), F.hyd())));
  }

  // ================================================================== bay / well liners
  {
    const g = [];
    // side weapons bays (in the trunk walls)
    const stS = stations(FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, 0.4);
    for (const side of [1, -1]) {
      const edge = (s) => {
        const wf = FR.wallFractions(s);
        const a = FR.wallB(s, wf[4]), b = FR.wallB(s, wf[7]);
        return [[X(s), a[1], side * a[0]], [X(s), b[1], side * b[0]]];
      };
      g.push(cavity(stS, edge, () => [0, 0.08, -side * 0.99], 0.34));
    }
    // main-gear wells
    const stW = stations(FR.MAIN_WELL.s0, FR.MAIN_WELL.s1, 0.4);
    for (const side of [1, -1]) {
      const edge = (s) => [[X(s), -FR.bD(s), side * Math.min(FR.MAIN_WELL.z1, FR.bWb(s) - 0.05)], [X(s), -FR.bD(s), side * FR.MAIN_WELL.z0]];
      g.push(cavity(stW, edge, () => [0, 1, 0], 0.44));
    }
    // nose-gear well
    const stN = stations(FR.NOSE_WELL.s0, FR.NOSE_WELL.s1, 0.4);
    g.push(cavity(stN, (s) => [[X(s), FR.bottomAt(s, FR.NOSE_WELL.z), -FR.NOSE_WELL.z], [X(s), FR.bottomAt(s, FR.NOSE_WELL.z), FR.NOSE_WELL.z]], () => [0, 1, 0], 0.4));
    P('Side bay & gear-well liners', {
      system: 'Structure', material: 'Aluminium / composite liners', mass: 120, explode: [0, -0.35, 0],
      desc: 'Sealed liners form the two side weapons bays in the inlet trunks and the three landing-gear wells, keeping airflow and moisture out of the fuselage when the doors open.',
    }, mesh(merge(g), F.bay()));
  }

  return { ringsA, ringsB, sA, sB };
}
