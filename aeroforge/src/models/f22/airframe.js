// F-22A airframe: fuselage skins by section, primary structure (frames, titanium bulkheads,
// longerons, keel, EB-welded booms), wings with their multi-spar boxes, all-moving stabilators,
// canted vertical tails and every wing/tail control surface with its actuators.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { wingPanel, wingPoint, mirrorZ, naca00, mergeGeometries } from '../../engine/geometry.js';
import { F } from './materials.js';
import * as FR from './frame.js';
import { merge, dedupe, frameBand, platePoly, slab, hinge, ribPlate, sparWeb, mirror, toothedGrid } from './util.js';

const { X, P3, lerp, DEG, smooth } = FR;
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

/** Clip a closed polygon to y ≥ ymin. */
function clipAbove(poly, ymin) {
  return clipBelow(poly.map(([z, y]) => [z, -y]), -ymin).map(([z, y]) => [z, -y]);
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
  return cavityGrid(st.map((s) => {
    const [a, b] = edge(s);
    const d = inward(s).map((v) => v * depth);
    return [a, [a[0] + d[0], a[1] + d[1], a[2] + d[2]], [b[0] + d[0], b[1] + d[1], b[2] + d[2]], b];
  }));
}

/** Cavity liner from rows of any equal length (opening edge, round the back, opening edge), ear-clipped end caps. */
export function cavityRows(grid) {
  const pos = [], idx = [];
  const m = grid.length, k = grid[0].length;
  for (const row of grid) for (const p of row) pos.push(...p);
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < k - 1; c++) {
      const a = r * k + c, b = a + 1, cc = a + k, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
  }
  for (const r of [0, m - 1]) {
    const contour = grid[r].map((p) => new THREE.Vector2(p[2], p[1]));
    for (const f of THREE.ShapeUtils.triangulateShape(contour, [])) idx.push(r * k + f[0], r * k + f[1], r * k + f[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cavity liner from rows of four points per station: opening edge, two back corners, opening edge. */
export function cavityGrid(grid) {
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

/** Spar caps: flat flanges along the upper and lower skins at chord fraction f. */
function sparCaps(secs, f, w, t, scale) {
  const geo = [];
  for (const sgn of [1, -1]) {
    const grid = secs.map((sec) => {
      const x = sec.le[0] - f * sec.chord, h = naca00(f, sec.t) * sec.chord * scale;
      return [[x + w / 2, sec.le[1] + sgn * h, sec.le[2]], [x - w / 2, sec.le[1] + sgn * h, sec.le[2]]];
    });
    geo.push(slab(grid, () => [0, -sgn * t, 0]));
  }
  return merge(geo);
}

/**
 * Slide a wing panel's root-station vertices (z = root z) outboard along their own chord lines until each clears
 * the inlet duct by 2.5 cm. The skin root runs inside the fuselage, and without this its inboard strip would
 * cross the engine air passage of the caret inlet and S-duct.
 */
function trimRootFromDuct(g, root, tip) {
  const p = g.attributes.position, zr = root.le[2];
  const q = [0, 0, 0];
  const atRoot = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getZ(i) - zr) > 1e-6) continue;
    atRoot[i] = 1;
    const xc = (root.le[0] - p.getX(i)) / root.chord;
    let yt = (p.getY(i) - root.le[1]) / (root.chord * root.t);
    const at = (eta) => {
      const ch = root.chord + (tip.chord - root.chord) * eta, t = root.t + (tip.t - root.t) * eta;
      q[0] = root.le[0] + (tip.le[0] - root.le[0]) * eta - xc * ch;
      q[1] = root.le[1] + (tip.le[1] - root.le[1]) * eta + yt * ch * t;
      q[2] = root.le[2] + (tip.le[2] - root.le[2]) * eta;
    };
    // upper and lower points at one chord station (and the mid-plane between) move together, so the faces
    // that join them through the wing stay clear of the duct as well
    const ytv = yt;
    const clear = (e) => { at(e); return FR.ductDepth(FR.SN - q[0], q[1], q[2]) <= -0.025; };
    let eta = 0;
    for (const f of [1, 0.5, 0, -0.5, -1]) {
      yt = ytv * f;
      if (clear(eta)) continue;
      let lo = eta, hi = eta;
      while (hi < 0.07 && !clear(hi)) { lo = hi; hi = Math.min(0.07, hi + 0.008); }
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (clear(m)) hi = m; else lo = m; }
      eta = hi;
    }
    yt = ytv;
    at(eta);
    if (eta > 0) p.setXYZ(i, q[0], q[1], q[2]);
  }
  // the root end cap (all three corners on the root station) is dropped: the root lies inside the fuselage, and
  // once its edge is trimmed a flat cap would span the duct's outer corner
  const idx = g.index.array, kept = [];
  for (let k = 0; k < idx.length; k += 3) if (!(atRoot[idx[k]] && atRoot[idx[k + 1]] && atRoot[idx[k + 2]])) kept.push(idx[k], idx[k + 1], idx[k + 2]);
  g.setIndex(kept);
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function buildAirframe(ctx) {
  const { P, anim } = ctx;

  // ================================================================== fuselage A (nose → S_AB)
  const RS = FR.M(2.55);                       // radar bulkhead / radome joint (radome length approximate)
  const sA = stations(0, FR.S_AB, 0.13, [0.05, 0.12, 0.22, 0.35, 0.5, 0.7, 0.95, 1.25, 1.6, 2.0, RS, FR.CANOPY_S0, FR.HOLE_S0, FR.HOLE_S1, FR.CANOPY_S1, FR.NOSE_WELL.s0, FR.NOSE_WELL.s1]);
  const ringsA = sA.map((s) => FR.ringA(s).pts);
  const HA = FR.ringA(1).half;           // points in one half (25)
  const mirA = (j) => (j < HA - 1 ? j : 2 * HA - 3 - j);
  const keepA = (st) => (i, j) => {
    const q = mirA(j), s0 = st[i], s1 = st[i + 1];
    if (q < 5 && s0 >= FR.HOLE_S0 - 1e-6 && s1 <= FR.HOLE_S1 + 1e-6) return false;
    if (q >= 21 && q <= 23 && inRange(s0, s1, FR.NOSE_WELL)) return false;
    return true;
  };
  const iR = sA.indexOf(RS);
  const radome = P('Radome', {
    system: 'Skin & fairings', skin: true, material: 'Quartz / cyanate-ester composite shell with frequency-selective layers',
    mass: 95, explode: [3.4, 0.2, 0], temp: 288,
    desc: 'A smooth, chined composite radome about 2.1 m long over the radar (joint station approximate): continuously curved like the rest of the F-22 (not faceted like the F-117), with its chine edges aligned to the planform. It is a frequency-selective surface, transparent in the AN/APG-77\'s own X band and reflective outside it, so it adds almost nothing to the radar cross-section.',
  }, mesh(FR.gridSurface(ringsA.slice(0, iR + 1), { closed: true }), F.skin()));
  radome.userData.part.thermalRole = 'stagnation';

  const stF = sA.slice(iR);
  P('Forward fuselage skin', {
    system: 'Skin & fairings', skin: true, material: 'Composite and aluminium panels with RAM coatings',
    mass: 320, explode: [1.3, 0.75, 0],
    desc: 'Skins the cockpit section from the radar bulkhead to the inlets, and the dorsal spine behind the canopy. The chine along each side is a sharp edge set at the same plan-view angle as the wing leading edge, so it reflects radar into the same few directions.',
  }, mesh(FR.gridSurface(ringsA.slice(iR), { closed: true, keep: keepA(stF) }), F.skin()));

  // ================================================================== fuselage B (S_AB → S_BE), booms and stinger
  const W = FR.MAIN_WELL;
  const S_MA = 11.7;                           // mid / aft fuselage skin split (Boeing's aft fuselage, which houses the engines)
  const bMust = [FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, FR.MAIN_BAY.s0, FR.MAIN_BAY.s1, W.s0, W.sStep, W.sStep + 0.01, W.sNotch, W.sNotch + 0.01, W.s1, S_MA, FR.CM_BAY.s0, FR.CM_BAY.s1, FR.ENGINE_DOOR.s0, FR.ENGINE_DOOR.s1];
  const sB = stations(FR.S_AB, FR.S_BE, 0.15, bMust);
  ctx.sB = sB;
  const ringsB = sB.map((s) => FR.ringB(s).pts);
  const HB = FR.ringB(10).half;           // 37
  const mirB = (j) => (j < HB - 1 ? j : 2 * HB - 3 - j);
  const keepB = (st, upper) => (i, j) => {
    const q = mirB(j), s0 = st[i], s1 = st[i + 1];
    if (upper !== (q <= 16)) return false;
    if (q >= 32 && inRange(s0, s1, FR.MAIN_BAY)) return false;
    if (q >= 28 && q <= 30 && inRange(s0, s1, W)) return false;
    if (q >= 21 && q <= 23 && inRange(s0, s1, FR.SIDE_BAY)) return false;
    if (q === 22 && inRange(s0, s1, FR.CM_BAY)) return false;
    if (q >= FR.ENGINE_DOOR.q0 && q < FR.ENGINE_DOOR.q1 && inRange(s0, s1, FR.ENGINE_DOOR)) return false;
    return true;
  };
  const iM = sB.indexOf(S_MA);
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
    desc: 'Wraps the intake trunks and the belly. The trunk walls lean inboard toward the flat bottom, parallel to the inlets\' walls and the canted fins. The openings for the main weapons bay, both side bays and the main-gear wells are cut here; their doors close flush with saw-toothed edges.',
  }, mesh(FR.gridSurface(rM, { closed: true, keep: keepB(stM, false) }), F.skin()));
  P('Aft fuselage upper skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium and high-temperature composite panels, engine-bay access doors',
    mass: 230, explode: [-0.6, 1.5, 0],
    desc: 'Covers the engine bays between the vertical tails, with access panels over the accessory drives and engine-bay equipment. The engines themselves come out downward, through the lower engine-change doors.',
  }, mesh(FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, true) }), F.skin()));
  // behind S_BE: a boom each side of the nozzles, cut off at 43° in plan under the stabilator, and the stinger
  const boomRing = (s, side) => {
    const zi = FR.boomInner(s), w = FR.bW(s), D = FR.bD(s), wb = FR.bWb(s);
    const zTop = Math.min(zi, w - 0.01);
    const half = [];
    for (let k = 0; k <= 10; k++) { const z = lerp(zTop, w, k / 10); half.push([z, FR.upperB(s, z)]); }
    // trunk wall from the chine down to the lower corner, or to where it meets the boom's inner wall
    let yEnd = -D;
    if (wb < zTop) { let lo = -D, hi = 0; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (FR.wallZ(s, m) < zTop) lo = m; else hi = m; } yEnd = (lo + hi) / 2; }
    for (let k = 1; k <= 8; k++) { const y = lerp(0, yEnd, k / 8); half.push([FR.wallZ(s, y), y]); }
    for (let k = 1; k <= 4; k++) half.push(wb > zTop ? [lerp(wb, zTop, k / 4), -D] : [zTop, yEnd]);
    const yBot = half[half.length - 1][1], yTop = half[0][1];
    for (let k = 1; k < 5; k++) half.push([zTop, lerp(yBot, yTop, k / 5)]);
    return half.map(([z, y]) => [X(s), y, side * z]);
  };
  const sBoom = [];
  for (let s = FR.S_BE; s < FR.BOOM.sEnd1 - 0.02; s += 0.15) sBoom.push(s);
  sBoom.push(FR.BOOM.sEnd1 - 0.02);
  const booms = [];
  for (const side of [1, -1]) {
    const rings = sBoom.map((s) => boomRing(s, side));
    // the last ring collapses to the end point of the 43° cut
    booms.push(FR.gridSurface(side > 0 ? rings : rings.map((r) => r.slice().reverse()), { closed: true, uv: 'n' }));
    const endR = rings[rings.length - 1];
    booms.push(capAft(endR));
  }
  const ST = FR.STINGER;
  const stg = [];
  for (let s = FR.S_BE; s <= ST.s1 + 1e-6; s += 0.25) {
    const t = (s - FR.S_BE) / (ST.s1 - FR.S_BE);
    const top = FR.mono([[FR.S_BE, FR.bHT(FR.S_BE) - 0.04], [16.0, 0.27], [16.5, 0.15], [17.0, 0.045], [ST.s1, 0.02]], s), bot = Math.max(-FR.bD(s), -FR.bD(FR.S_BE));
    const hw = ST.half * (1 - 0.85 * smooth(0.82, 1, t)), hh = (top - bot) * (1 - 0.75 * smooth(0.82, 1, t));
    stg.push(FR.superRing(X(s), 0, (top + bot) / 2, 2 * hw, hh, 16, 3.4));
  }
  P('Aft fuselage lower skin', {
    system: 'Skin & fairings', skin: true, material: 'Titanium panels (hot structure beside the nozzles)',
    mass: 210, explode: [-0.6, -1.3, 0],
    desc: 'The underside of the engine bays, the two tail booms that run aft beside the nozzles to the stabilators, and the stinger between the nozzles that houses the arresting hook. The nozzles end inside the booms, which shield them from the side. Titanium is used where exhaust heat would soften aluminium or composites; the two large engine-change doors are cut into the underside.',
  }, [mesh(merge([FR.gridSurface(rAft, { closed: true, keep: keepB(stAft, false) }), ...booms, FR.gridSurface(stg, { closed: true, uv: 'n' }), capAft(stg[stg.length - 1])]), F.skin())]);

  // lower engine-change doors: each F119 is lowered out of its bay on a trailer
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const { s0, s1, q0, q1 } = FR.ENGINE_DOOR;
    const st = sB.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
    const zAt = (s, u) => { const zs = FR.bottomSamples(s); return lerp(zs[q0 - 27], zs[q1 - 27], u); };
    const grid = toothedGrid((s, u) => [X(s), -FR.bD(s) - 0.002, side * zAt(s, u)], st, { width: 1.02 });
    const door = slab(grid, () => [0, 0.025, 0], V(0, -1, 0));
    const seams = [];
    for (const s of [s0 + 0.02, (s0 + s1) / 2, s1 - 0.02]) seams.push(new THREE.BoxGeometry(0.03, 0.012, 1.0).translate(X(s), -FR.bD(s) + 0.012, side * 0.8));
    P(`Engine-change door (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Titanium / composite door on quick-release hinges and latches', mass: 70,
      explode: [-0.4, -1.9, 0.45 * side],
      desc: 'A large door under each engine bay, saw-toothed fore and aft. To change an F119 the door is opened, the engine is lowered straight down onto a trailer and a spare is raised in; the axially split case and colour-coded harnesses keep the job short (layout approximate).',
    }, [mesh(door, F.door()), mesh(merge(seams), F.tiDull())]);
  }

  // ================================================================== primary structure
  // forward fuselage: radar bulkhead, cockpit bulkheads and U-frames around the cockpit
  {
    const g = [];
    // forward cockpit pressure bulkhead: from the cockpit floor up to the panel (the nose-gear well is below)
    g.push(platePoly(FR.HOLE_S0, clipAbove(clipBelow(zy(FR.ringA(FR.HOLE_S0).pts), 0.4), 0.025), 0.025));
    // aft cockpit pressure bulkhead behind the seat, under the turtle deck
    const sAft = 5.46;
    g.push(platePoly(sAft, clipAbove(zy(FR.ringA(sAft).pts), -0.02), 0.025));
    for (const s of [FR.M(3.1), FR.M(3.75), FR.M(5.0), FR.M(5.7), FR.M(6.4), 6.2]) {
      const ys = FR.upperA(s, FR.sillW(s)) - 0.05;
      const cut = s > FR.HOLE_S0 && s < FR.HOLE_S1;
      g.push(frameBand(s, zy(FR.ringA(s).pts), { depth: 0.07, thick: 0.03, keep: cut ? (p) => p[1] < ys || Math.abs(p[0]) > FR.sillW(s) + 0.06 : null }));
    }
    P('Forward fuselage frames & bulkheads', {
      system: 'Structure', material: 'Aluminium and titanium machined frames', mass: 410, explode: [1.7, 0.4, 0],
      desc: 'Behind the forward avionics bay the forward and aft cockpit pressure bulkheads close the cockpit, and U-shaped frames pass under the canopy sills. Lockheed Martin built the forward fuselage at Marietta, about half aluminium and half composite.',
    }, mesh(merge(g), F.alu()));
    // radar bulkhead: a stiffened plate across the whole nose section, with the radome attach ring
    const rb = [platePoly(RS, zy(FR.ringA(RS).pts), 0.03)];
    rb.push(frameBand(RS - 0.02, zy(FR.ringA(RS - 0.02).pts), { depth: 0.05, thick: 0.03, skinGap: 0.004 }));
    const sr = RS + 0.035;
    for (const zz of [-0.36, 0, 0.36]) {
      const y0 = FR.bottomAt(sr, zz) + 0.04, y1 = FR.topAt(sr, Math.abs(zz)) - 0.04;
      rb.push(FR.boxS(sr, (y0 + y1) / 2, zz, 0.04, y1 - y0, 0.03));
    }
    for (const yy of [-0.25, 0.18]) {
      let hw = 0;
      for (let zz = 0; zz < FR.aW(sr); zz += 0.01) if (FR.bottomAt(sr, zz) < yy - 0.04 && FR.topAt(sr, zz) > yy + 0.04) hw = zz;
      rb.push(FR.boxS(sr, yy, 0, 0.04, 0.03, 2 * hw));
    }
    P('Radar bulkhead', {
      system: 'Structure', material: 'Machined aluminium bulkhead with stiffeners, radome attach ring', mass: 45,
      explode: [2.3, -0.35, 0],
      desc: `Closes the front of the fuselage about ${RS.toFixed(1)} m behind the nose tip (station approximate). Its face carries the mount for the 1,956-module APG-77 array (about 0.9 m across), its rim the attach ring and latches for the radome, which swings or comes off for radar maintenance.`,
    }, mesh(merge(rb), F.alu()));
  }
  // mid fuselage (Lockheed Martin Fort Worth; ≈ 30 % titanium, 30 % aluminium, 30 % composite): titanium
  // wing-carry-through bulkheads where the titanium front and mid spars attach, aluminium frames between
  // (the titanium spars reach the side of the body at the stations below; the RTM spars between them)
  const sparAt = (f) => FR.wingLE(FR.WING.bodyZ) + f * (FR.wingTE(FR.WING.bodyZ) - FR.wingLE(FR.WING.bodyZ));
  {
    // each frame stays 3 cm clear of the inlet ducts that pass through it: where a duct comes close to the skin
    // the frame is made shallower
    // (checked at both faces of the frame, since the duct moves across it); where the duct runs right up to the
    // skin, as it does just behind the inlet, the frame stops either side of it
    // (the main-gear wells too: the bulkhead over them stops round the wheel bay)
    const depAt = (s, th) => (y, z) => Math.max(...[s - th / 2, s, s + th / 2].map((ss) => Math.max(FR.ductDepth(ss, y, z), FR.mainWellDepth(ss, y, z))));
    const clipDuct = (s, th) => {
      const dep = depAt(s, th);
      return (o, i) => {
        if (dep(i[1], i[0]) < -0.03) return i;
        let lo = 0, hi = 1;                                 // fraction of the way from the outer edge to i
        for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (dep(lerp(o[1], i[1], m), lerp(o[0], i[0], m)) < -0.03) lo = m; else hi = m; }
        return [lerp(o[0], i[0], lo), lerp(o[1], i[1], lo)];
      };
    };
    const band = (s) => {
      const D = FR.bD(s);
      const sideBay = s > FR.SIDE_BAY.s0 && s < FR.SIDE_BAY.s1, dep = depAt(s, 0.05);
      return frameBand(s, zy(FR.ringB(s).pts), {
        depth: 0.15, thick: 0.05, clip: clipDuct(s, 0.05), avoid: (p) => dep(p[1], p[0]) > -0.028,
        keep: (p) => !(p[1] < -D + 0.12 && Math.abs(p[0]) < FR.MAIN_BAY.z + 0.05) && !(sideBay && p[1] < FR.SIDE_BAY.y0 + 0.04 && p[1] > FR.SIDE_BAY.y1 - 0.04 && Math.abs(p[0]) > FR.wallZ(s, -0.6) - 0.4) && dep(p[1], p[0]) < -0.015,
      });
    };
    // forward bulkhead behind the inlets, the front-spar bulkhead, and the bulkhead just ahead of the fan faces
    // that carries the main-gear trunnions
    P('Mid-fuselage titanium bulkheads', {
      system: 'Structure', material: 'Ti-6Al-4V bulkheads machined from large forgings', mass: 620, xrayWeight: 0.5,
      explode: [0, 0.65, 0],
      desc: 'Heavy wing-carry-through bulkheads, where the titanium front spar and the main-gear loads come in, carry wing bending across the fuselage around the inlet ducts and over the main weapons bay. Titanium is about 40 % of the F-22\'s structural weight (sources give 39–42 %), more than any earlier US fighter (assignment of bulkheads approximate).',
    }, mesh(merge([FR.M(8.6), sparAt(0.10), 11.25].map(band)), F.ti()));
    P('Mid-fuselage aluminium frames', {
      system: 'Structure', material: 'Machined aluminium frames', mass: 260, xrayWeight: 0.5,
      explode: [0, 0.9, 0],
      desc: 'Lighter frames between the titanium bulkheads, where the composite spars attach. The mid fuselage is built as three modules with about 5,000 structural parts and over 100,000 fasteners, and houses all or part of the fuel, hydraulic, electrical, environmental and APU systems.',
    }, mesh(merge([8.25, sparAt(0.23)].map(band)), F.alu()));
  }
  // engine-bay frames (the mid and rear titanium spars meet the aft fuselage here)
  {
    const g = [];
    for (const s of [sparAt(0.49), 12.95, sparAt(0.75), 14.75]) g.push(frameBand(s, zy(FR.ringB(s).pts), { depth: 0.07, thick: 0.04 }));
    P('Engine-bay frames', {
      system: 'Structure', material: 'Titanium frames', mass: 420, explode: [-1.0, 0.9, 0],
      desc: 'Hoop frames around the two engine bays tie the keel, the booms and the upper deck together and carry the vertical-tail and stabilator loads forward; the wing\'s titanium mid and rear spars attach to them.',
    }, mesh(merge(g), F.tiDull()));
  }
  // keel and longerons
  {
    const g = [];
    const keel = [];
    for (let s = 11.6; s <= FR.S_BE + 1.3; s += 0.25) keel.push(s);
    // keel web between the engines, carried on into the stinger
    const kTop = (s) => (s < FR.S_BE ? FR.topAt(s, 0) - 0.06 : lerp(FR.bHT(FR.S_BE) - 0.1, 0.12, (s - FR.S_BE) / 1.4));
    const kBot = (s) => (s < FR.S_BE ? -FR.bD(s) + 0.05 : lerp(-FR.bD(FR.S_BE) + 0.06, -0.62, (s - FR.S_BE) / 1.4));
    const grid = [keel.map((s) => [X(s), kTop(s), 0]), keel.map((s) => [X(s), kBot(s), 0])];
    g.push(slab([grid[0].map((p) => [p[0], p[1], -0.02]), grid[1].map((p) => [p[0], p[1], -0.02])], () => [0, 0, 0.04]));
    // weapons-bay longerons along the door edges and the bay ceiling
    const yL = (s) => -FR.bD(s) + 0.045;
    for (const z of [-0.81, 0.81]) {
      // the bay-edge longerons end at the bay's aft wall, where the main-gear well begins; from that wall keel
      // longerons inboard of the wheel bays carry on into the engine bays
      const s0 = FR.MAIN_BAY.s0, s1 = FR.MAIN_BAY.s1;
      g.push(FR.pipe([[s0, yL(s0), z], [lerp(s0, s1, 0.4), yL(lerp(s0, s1, 0.4)), z], [s1 - 0.35, yL(s1 - 0.35), z], [s1 - 0.02, yL(s1 - 0.02), z]], 0.035, 6));
      g.push(FR.pipe([[s1 + 0.01, -0.86, z * 0.4], [s1 + 0.6, -0.86, z * 0.4], [s1 + 1.1, -0.84, z * 0.4]], 0.035, 6));
      // ceiling longeron along the break of the bay ceiling, stepping inboard under the duct floor aft; at the
      // aft wall, where the duct floor comes down to the ceiling, it sits flush in the ceiling corner
      const cz = (sv) => Math.abs(z) * 0.75 - (0.6075 - 0.4) * FR.smooth(FR.BAY_AFT.s0, FR.BAY_AFT.s1, sv);
      const dy = (sv) => 0.035 - 0.03 * FR.smooth(s1 - 0.3, s1, sv);
      g.push(FR.pipe([s0 - 0.1, FR.M(10.4), FR.BAY_AFT.s0, FR.M(11.7), FR.BAY_AFT.s1, s1 - 0.11, s1 + 0.01].map((sv) => [sv, FR.bayCeilAt(sv, cz(sv)) + dy(sv), Math.sign(z) * cz(sv)]), 0.03, 6, 24));
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
      for (let s = FR.M(2.7); s <= FR.M(7.6); s += 0.35) {
        const z = Math.max(0.42, FR.sillW(s) + 0.07);
        fwd.push([s, FR.topAt(s, Math.min(z, FR.aW(s) - 0.05)) - 0.06, side * Math.min(z, FR.aW(s) - 0.05)]);
      }
      g.push(FR.pipe(fwd, 0.028, 6));
      const mid = [];
      for (let s = FR.M(7.6); s <= FR.S_BE - 0.1; s += 0.5) mid.push([s, FR.topAt(s, 0.45) - 0.06, side * 0.45]);
      g.push(FR.pipe(mid, 0.028, 6));
      const chine = [];
      for (let s = FR.M(2.7); s <= FR.S_AB - 0.2; s += 0.4) chine.push([s, FR.aYC(s) - 0.02, side * (FR.aW(s) - 0.06)]);
      g.push(FR.pipe(chine, 0.022, 6));
    }
    P('Upper longerons & canopy rails', {
      system: 'Structure', material: 'Titanium extrusions', mass: 140, explode: [0.4, 1.0, 0],
      desc: 'Continuous longerons along the cockpit sills (the canopy rails), the upper deck and the forward chines carry fuselage bending between the frames.',
    }, mesh(merge(g), F.tiDull()));
  }
  // EB-welded titanium aft booms, beside the engines and nozzles, that carry the vertical tails and the stabilator pivots
  for (const side of [1, -1]) {
    const g = [];
    const rings = [];
    const BZ = 1.55;
    // the box section tapers in depth aft, staying inside the boom skin as it thins toward the stabilator
    const boomTop = (s) => Math.min(0.3, FR.upperB(s, BZ + 0.12) - 0.035), boomBot = (s) => Math.max(-0.2, -FR.bD(s) + 0.05);
    const ring = (s, dw = 0, dh = 0) => FR.superRing(X(s), side * BZ, (boomTop(s) + boomBot(s)) / 2, 0.2 + dw, boomTop(s) - boomBot(s) + dh, 12, 6);
    for (const s of [11.75, 12.6, 13.6, 14.6, 15.6, 16.6, 17.33]) rings.push(ring(s));
    g.push(FR.gridSurface(rings, { closed: true }));
    // machined forward, middle and end frames that the isogrid panels are welded to
    const frames = [];
    for (const s of [11.75, 14.6, 17.3]) frames.push(FR.gridSurface([ring(s - 0.03, 0.025, 0.02), ring(s + 0.03, 0.025, 0.02)], { closed: true, uv: 'n' }));
    P(side > 0 ? 'Aft boom (right)' : 'Aft boom (left)', {
      system: 'Structure', material: 'Ti-6Al-4V isogrid panels electron-beam welded to machined frames (90+ pieces per ship set)', mass: 310,
      explode: [-1.9, 0.25, 1.15 * side],
      desc: 'Box-section titanium booms outboard of each engine carry the vertical tail and stabilator; the aft fuselage is 55 % titanium because the booms run beside the hot nozzles. Aerojet robotically electron-beam welded integrally stiffened isogrid panels to machined forward, middle and end frames — about 3,600 in (91 m) of welds per ship set instead of fasteners.',
    }, [mesh(merge(g), F.isogrid()), mesh(merge(frames), F.ti())]);
  }

  // ================================================================== wings
  // two trapezoids: root → the trailing-edge kink at z 5.87, then the 42° tip clip to the 1.1 m tip chord
  const ZR = 1.45, ZK = FR.WING.kinkZ, ZT = FR.WING.semi;
  const wRoot = FR.wingSection(ZR), wKink = FR.wingSection(ZK), wTip = FR.wingSection(ZT);
  const PAN = [[wRoot, wKink, ZR, ZK], [wKink, wTip, ZK, ZT]];
  /** wingPanel pieces between spans za and zb (split at the kink), chord fractions c0..c1. */
  const wingPieces = ({ c0, c1, za, zb, stations = 2 }) => {
    const out = [];
    for (const [r, t, z0, z1] of PAN) {
      const a = Math.max(za, z0), b = Math.min(zb, z1);
      if (b - a < 1e-6) continue;
      const eta0 = (a - z0) / (z1 - z0), eta1 = (b - z0) / (z1 - z0);
      const n = Math.max(1, Math.round((stations * (b - a)) / (zb - za)));
      const g = wingPanel({ root: r, tip: t, n: 22, c0, c1, eta0, eta1, stations: n });
      out.push(eta0 === 0 && r === wRoot ? trimRootFromDuct(g, wRoot, wKink) : g);
    }
    return out;
  };
  /** Mid-thickness point on the wing at span z and chord fraction cf. */
  const wPt = (z, cf) => { const sec = FR.wingSection(z); return V(sec.le[0] - cf * sec.chord, sec.le[1], z); };
  const SF = FR.SURF, HF = SF.hinge;
  const naca = naca00;
  for (const side of [1, -1]) {
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    const mz = (v) => new THREE.Vector3(v.x, v.y, v.z * side);
    const R = side > 0 ? 'right' : 'left';
    const panel = (o) => wingPieces(o).map(flip);
    const skin = [
      ...panel({ c0: HF.lef, c1: HF.flaperon, za: ZR, zb: SF.aileron[0], stations: 6 }),
      ...panel({ c0: HF.lef, c1: HF.aileron, za: SF.aileron[0], zb: ZK, stations: 3 }),
      ...panel({ c0: HF.lef, c1: 1, za: ZK, zb: ZT, stations: 2 }),
      ...panel({ c0: 0, c1: HF.lef, za: ZR, zb: SF.lef[0], stations: 1 }),
      ...panel({ c0: 0, c1: HF.lef, za: SF.lef[1], zb: ZT, stations: 1 }),
      ...panel({ c0: HF.flaperon, c1: 1, za: ZR, zb: SF.flaperon[0], stations: 1 }),
      ...panel({ c0: HF.flaperon, c1: 1, za: SF.flaperon[1] - 0.02, zb: SF.flaperon[1], stations: 1 }),
      ...panel({ c0: HF.aileron, c1: 1, za: SF.aileron[0], zb: SF.aileron[0] + 0.02, stations: 1 }),
      ...panel({ c0: HF.aileron, c1: 1, za: SF.aileron[1] - 0.02, zb: ZK, stations: 1 }),
    ];
    const wing = P(`Wing skin (${R})`, {
      system: 'Skin & fairings', skin: true, material: 'Bismaleimide composite skins, RAM-treated edges', mass: 420,
      explode: [0, 0.35, 2.7 * side], callout: false,
      desc: 'Upper and lower skins of a 42°-swept wing with a −17° trailing edge; 78.04 m² for both wings (reference trapezoid) and a 13.56 m span, with 3.25° of anhedral. Outboard of the ailerons the trailing edge is cut back parallel to the leading edge, so the real tip chord is only about 1.1 m. The real wing uses NACA 64A-series sections (5.92 % thick at the root, 4.29 % at the tip) with conical camber and twist; the model keeps the thickness but uses symmetric sections.',
    }, mesh(mergeGeometries(skin), F.wing()));                     // one mesh; the panels keep their chord / side attributes
    wing.userData.part.thermalRole = 'leadingEdge';

    // control surfaces
    const surf = (name, info, o, c, toward, testCf) => {
      const geo = mergeGeometries(panel(o));
      const p0 = mz(wPt(o.za, c)), p1 = mz(wPt(o.zb, c));
      const test = mz(wPt((o.za + o.zb) / 2, testCf));
      const h = hinge(mesh(geo, F.wing()), p0, p1, test, toward);
      const part = P(name, info, h.pivot);
      part.userData.part.thermalRole = info.thermal || null;
      return h;
    };
    const down = V(0, -1, 0);
    anim.lef.push({ side, h: surf(`Leading-edge flap (${R})`, {
      system: 'Flight controls', material: 'Composite over titanium torque tube', mass: 95, explode: [1.0, 0.1, 2.9 * side], thermal: 'leadingEdge',
      desc: 'A flap along most of the leading edge, from just outboard of the body to near the tip, driven by rotary actuators. It droops automatically with angle of attack to keep the flow attached, extending usable lift toward the 60° angles of attack the F-22 can fly with thrust vectoring.',
    }, { c0: 0, c1: HF.lef, za: SF.lef[0], zb: SF.lef[1], stations: 6 }, HF.lef, down, 0.0) });
    anim.flaperon.push({ side, h: surf(`Flaperon (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 120, explode: [-1.4, 0.15, 2.4 * side],
      desc: 'Inboard trailing-edge surface, from the body out to mid-span, that works as a flap for take-off and landing and as an aileron for roll. With the ailerons and rudders it also serves as the speed brake — the F-22 has no separate airbrake panel.',
    }, { c0: HF.flaperon, c1: 1, za: SF.flaperon[0], zb: SF.flaperon[1] - 0.02, stations: 3 }, HF.flaperon, down, 1) });
    anim.aileron.push({ side, h: surf(`Aileron (${R})`, {
      system: 'Flight controls', material: 'Composite', mass: 60, explode: [-1.2, 0.15, 3.3 * side],
      desc: 'Outboard trailing-edge surface for roll, ending where the tip is cut back. The fly-by-wire system blends it with the flaperons, differential stabilators and, at low speed, the rudders.',
    }, { c0: HF.aileron, c1: 1, za: SF.aileron[0] + 0.02, zb: SF.aileron[1] - 0.02, stations: 3 }, HF.aileron, down, 1) });

    // wing box (Boeing; the wing is almost 50 % titanium): titanium front, mid and rear spars machined
    // from forgings, resin-transfer-moulded "sine-wave" composite intermediate spars, ribs, and root
    // fittings that bolt the spars to the mid-fuselage bulkheads at the side of the body
    const zSOB = FR.WING.bodyZ - 0.08, zEnd = 6.7;
    const TI_F = [0.10, 0.49, 0.75], RTM_F = [0.23, 0.36, 0.62];
    const spanSecs = [zSOB, 2.7, 3.4, 4.1, 4.8, 5.5, ZK, 6.3, zEnd].map((z) => FR.wingSection(z));
    const ti = [], rtm = [], ribs = [], fits = [];
    for (const f of TI_F) {
      ti.push(sparWeb(spanSecs, f, f === 0.49 ? 0.018 : 0.024, 0.9, naca));
      ti.push(sparCaps(spanSecs, f, 0.075, 0.012, 0.9));
    }
    for (const f of RTM_F) {
      // corrugated web: a sine wave in plan (≈ 0.16 m pitch, estimate) stiffens a thin composite web
      const wave = [];
      for (let z = zSOB; z <= zEnd + 1e-6; z += 0.02) {
        const sec = FR.wingSection(z);
        wave.push({ le: [sec.le[0] + 0.018 * Math.sin((2 * Math.PI * (z - zSOB)) / 0.16), sec.le[1], z], chord: sec.chord, t: sec.t });
      }
      rtm.push(sparWeb(wave, f, 0.01, 0.9, naca));
      rtm.push(sparCaps(spanSecs, f, 0.06, 0.008, 0.9));
    }
    for (const z of [zSOB, 2.65, 3.25, 3.85, 4.45, 5.05, 5.55, ZK, 6.3, zEnd]) ribs.push(ribPlate(FR.wingSection(z), 0.1, 0.75, z === zSOB ? 0.02 : 0.012, 0.88, naca));
    // root fittings: a lug on each spar end, bolted to the bulkhead it lines up with
    const sob = FR.wingSection(zSOB);
    for (const f of [...TI_F, ...RTM_F]) {
      const x = sob.le[0] - f * sob.chord, hh = naca(f, sob.t) * sob.chord * 0.9;
      // short in z, so the lugs stay in the side wall clear of the gun, its ammunition container and the APU ducts
      fits.push(new THREE.BoxGeometry(0.16, hh * 1.7, 0.06).translate(x, sob.le[1], zSOB - 0.03));
      for (const dy of [-hh * 0.55, hh * 0.55]) fits.push(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10).rotateX(Math.PI / 2).translate(x, sob.le[1] + dy, zSOB - 0.03));
    }
    const sideG = (g) => (side > 0 ? g : mirror(g));
    P(`Wing titanium spars (${R})`, {
      system: 'Structure', material: 'Ti-6Al-4V spars machined from forgings, with spar caps', mass: 330,
      explode: [0, -0.2, 2.2 * side], callout: side > 0, anchor: [X(FR.WM(10.44)), FR.wingY(3.4), 3.4 * side],
      desc: 'The front, mid and rear spars are machined titanium forgings. Boeing\'s wing is almost 50 % titanium, partly because an intermediate composite spar was changed to titanium wherever it was needed to tolerate battle damage (every third one, by Flight\'s account).',
    }, mesh(sideG(merge(ti)), F.tiDull()));
    P(`Wing RTM sine-wave spars (${R})`, {
      system: 'Structure', material: 'Resin-transfer-moulded composite spars with corrugated (sine-wave) webs', mass: 120,
      explode: [0, -0.5, 2.35 * side],
      desc: 'Intermediate spars made by resin transfer moulding: dry fibre preforms are injected with resin in a closed mould, and the wavy web stays stiff without heavy stiffeners. Dow-UT delivered these RTM spars — 44 per ship set — among the first production RTM primary structure.',
    }, mesh(sideG(merge(rtm)), F.composite()));
    P(`Wing ribs (${R})`, {
      system: 'Structure', material: 'Machined aluminium / titanium and composite ribs', mass: 230,
      explode: [0, 0.15, 2.5 * side],
      desc: 'Ribs across the spars hold the airfoil shape, carry the skin loads into the spars and divide the integral wing tank into bays (rib count approximate). The root rib closes the wing at the side of the body.',
    }, mesh(sideG(merge(ribs)), F.alu()));
    P(`Wing root attach fittings (${R})`, {
      system: 'Structure', material: 'Titanium lugs and high-strength steel shear pins', mass: 110,
      explode: [0, -0.15, 1.7 * side],
      desc: 'Each spar ends in a lug at the side of the body, pinned to the fuselage bulkhead or frame it lines up with, so wing bending passes straight into the fuselage carry-through structure (lug detail approximate).',
    }, mesh(sideG(merge(fits)), F.steel()));

    // wing control actuators: LEF power drive unit, torque tube and rotary actuators; trailing-edge actuators
    {
      const g = [];
      const lefA = mz(wPt(SF.lef[0] + 0.05, 0.1)), lefB = mz(wPt(SF.lef[1] - 0.1, 0.1));
      g.push(FR.pipe([[FR.SN - lefA.x, lefA.y, lefA.z], [FR.SN - lefB.x, lefB.y, lefB.z]], 0.014, 6, 4));
      for (const z of [2.7, 3.5, 4.3, 5.1, 5.9]) {
        const p = mz(wPt(z, 0.1));
        // geared rotary actuator on the torque tube, sized to the local wing depth behind the flap hinge,
        // with its output arm forward to the flap
        const sec = FR.wingSection(z);
        const r = Math.min(0.05, naca(0.1, sec.t) * sec.chord * 0.5);
        g.push(new THREE.CylinderGeometry(r, r, 0.2, 12).rotateX(Math.PI / 2).translate(p.x, p.y, p.z));
        g.push(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.05, 12).rotateX(Math.PI / 2).translate(p.x, p.y, p.z + 0.06));
        g.push(new THREE.BoxGeometry(0.16, r * 0.6, 0.03).translate(p.x + 0.08, p.y, p.z - 0.06));
      }
      // power drive unit at the wing root, just outboard of the body side, geared into the inboard end of the torque tube
      const pdu = mz(wPt(SF.lef[0] - 0.06, 0.1));
      g.push(new THREE.BoxGeometry(0.26, 0.09, 0.13).translate(pdu.x, pdu.y, pdu.z));
      P(`Leading-edge flap drive (${R})`, {
        system: 'Flight controls', material: 'Hydraulic power drive unit, titanium torque tube, rotary geared actuators', mass: 55, explode: [0.6, -0.6, 2.6 * side],
        desc: 'A hydraulic power drive unit at the wing root turns a torque tube along the front spar, and geared rotary actuators along it move the leading-edge flap. Curtiss-Wright developed these geared rotary actuators and has supplied them since the start of the programme (actuator count approximate; each is sized to the local wing depth).',
      }, mesh(merge(g), F.hyd()));
      const t = [];
      for (const k of ['flaperon', 'aileron']) {
        const { z, c, len } = FR.TE_ACT[k];
        const p = mz(wPt(z, c));
        t.push(new THREE.CylinderGeometry(0.045, 0.04, len, 10).rotateZ(Math.PI / 2).translate(p.x + len / 2 - 0.05, p.y, p.z));
        t.push(new THREE.BoxGeometry(0.06, 0.07, 0.08).translate(p.x - 0.05, p.y, p.z));
      }
      P(`Flaperon & aileron actuators (${R})`, {
        system: 'Flight controls', material: 'Steel / titanium 4,000 psi linear hydraulic actuators', mass: 45, explode: [-0.5, -0.7, 2.6 * side],
        desc: 'One linear hydraulic actuator drives each surface, the flaperon and the aileron: the F-22 saves weight with a single actuator on every control surface and relies on flight-control reconfiguration if one fails (Flight International, 1997). Each is commanded electrically by the vehicle-management system (positions approximate).',
      }, mesh(merge(t), F.hyd()));
    }

    // store hardpoints inside the wing box: four in all, the inboard pair plumbed for 600 US gal ferry tanks
    {
      const g = [], f = [];
      for (const [zz, wet] of [[2.75, true], [4.15, false]]) {
        const p = mz(wPt(zz, 0.42));
        const sec = FR.wingSection(Math.abs(p.z));
        const yb = p.y - naca(0.42, sec.t) * sec.chord * 0.9;
        g.push(new THREE.BoxGeometry(0.62, 0.05, 0.12).translate(p.x, yb + 0.035, p.z));
        for (const dx of [-0.24, 0.24]) g.push(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10).translate(p.x + dx, yb + 0.02, p.z));
        g.push(new THREE.BoxGeometry(0.08, 0.04, 0.06).translate(p.x - 0.27, yb + 0.03, p.z));                     // aft pivot fitting
        if (wet) {
          // fuel and air (tank pressurisation) couplings, each piped up into the wing tank above
          f.push(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10).translate(p.x - 0.05, yb + 0.03, p.z + 0.08 * side));
          f.push(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10).translate(p.x + 0.1, yb + 0.03, p.z + 0.08 * side));
          f.push(FR.pipe([[FR.SN - (p.x - 0.05), yb + 0.06, p.z + 0.08 * side], [FR.SN - (p.x - 0.05), yb + 0.16, p.z + 0.1 * side], [FR.SN - (p.x + 0.1), yb + 0.2, p.z + 0.18 * side]], 0.014, 6, 6));
          f.push(FR.pipe([[FR.SN - (p.x + 0.1), yb + 0.055, p.z + 0.08 * side], [FR.SN - (p.x + 0.12), yb + 0.18, p.z + 0.08 * side]], 0.01, 6, 4));
          g.push(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10).translate(p.x + 0.18, yb + 0.03, p.z - 0.06 * side));   // electrical connector
        }
      }
      P(`Wing store hardpoints (${R})`, {
        system: 'Structure', material: 'Titanium pylon fittings and sway-brace pads, flush under the lower skin', mass: 30, count: 2,
        explode: [0, -1.1, 2.9 * side],
        desc: 'Two of the F-22\'s four underwing hardpoints, each rated for about 5,000 lb, with sway-brace pads and an aft pivot for the pylon. They are normally bare and covered flush; the inboard one also has fuel, air and electrical couplings for a 600 US gal (2,270 L) ferry tank on a BRU-47/A rack, at the cost of stealth.',
      }, [mesh(merge(g), F.tiDull()), mesh(merge(f), F.pipe())]);
    }

    // nav light lens and formation strip on the wing tip
    ctx.wingTips = ctx.wingTips || [];
    ctx.wingTips.push({ side, le: mz(new THREE.Vector3(wTip.le[0], wTip.le[1], wTip.le[2])), chord: wTip.chord });
  }

  // ================================================================== stabilators
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    const flip = (g) => (side > 0 ? g : mirrorZ(g));
    // the outline turns at the notch (cut-back leading edge → 42° edge), the trailing-edge vertex and the tip
    const brk = FR.STAB_BREAKS();
    const geo = [];
    for (let k = 0; k < brk.length - 1; k++) {
      const a = FR.stabSection(brk[k]), b = FR.stabSection(brk[k + 1]);
      geo.push(flip(wingPanel({ root: a, tip: b, stations: Math.max(1, Math.round((brk[k + 1] - brk[k]) / 0.4)), n: 20 })));
    }
    const p0 = V(X(FR.STAB.pivotS), FR.STAB.y, 0), p1 = V(X(FR.STAB.pivotS), FR.STAB.y, side);
    const testTE = V(X(18.0), FR.STAB.y, side * 2.6);
    const h = hinge(mesh(mergeGeometries(geo), F.wing()), p0, p1, testTE, V(0, -1, 0));
    const stab = P(`Stabilator (${R})`, {
      system: 'Flight controls', material: 'Composite skins on a titanium torque box', mass: 290,
      explode: [-2.3, -0.2, 1.9 * side], callout: false,
      desc: 'All-moving horizontal tail (8.84 m span over both sides) for pitch control. Its leading edge repeats the wing\'s 42°, and the aft-most point of the whole aircraft is the corner of its notched trailing edge. On the jet the inboard leading edge tucks under the flaperon; the model cuts it back to run just behind the wing (the real travel limits are not published). The two sides also move differentially to help roll at high angle of attack.',
    }, h.pivot);
    stab.userData.part.thermalRole = 'leadingEdge';
    anim.stab.push({ side, h });

    // torque box and spindle (rotates with the stabilator)
    const secs = [brk[0], brk[1], brk[2], 3.6, 4.3].map((z) => FR.stabSection(z));
    const g = [];
    for (const f of [0.15, 0.42, 0.7]) g.push(sparWeb(secs, f, 0.016, 0.88, naca00));
    for (const sec of secs) g.push(ribPlate(sec, 0.12, 0.75, 0.012, 0.86, naca00));
    const spindle = new THREE.CylinderGeometry(0.062, 0.062, 0.7, 16).rotateX(Math.PI / 2).translate(X(FR.STAB.pivotS), FR.STAB.y, FR.STAB.rootZ - 0.2);
    g.push(spindle);
    const boxGeo = merge(g);
    const hb = hinge(mesh(side > 0 ? boxGeo : mirror(boxGeo), F.ti()), p0, p1, testTE, V(0, -1, 0));
    P(`Stabilator torque box & spindle (${R})`, {
      system: 'Structure', material: 'Titanium spindle and spars', mass: 110, explode: [-2.3, -0.2, 1.4 * side],
      desc: 'The whole stabilator turns on a single titanium spindle carried in bearings in the aft boom (pivot station approximate); spars and ribs inside spread the load into the composite skins.',
    }, hb.pivot);
    anim.stab.push({ side, h: hb });

    // actuator in the boom driving the spindle crank
    const act = [];
    const ps = FR.STAB.pivotS;
    act.push(new THREE.CylinderGeometry(0.075, 0.065, 0.9, 12).rotateZ(Math.PI / 2 - 0.25).translate(X(ps - 0.5), -0.2, side * 1.62));
    act.push(new THREE.BoxGeometry(0.12, 0.3, 0.1).translate(X(ps), -0.12, side * 1.62));
    P(`Stabilator actuator (${R})`, {
      system: 'Flight controls', material: 'Dual-tandem hydraulic actuator, 4,000 psi', mass: 55, explode: [-1.6, -0.75, 1.25 * side],
      desc: 'The stabilator\'s single actuator (the F-22 has one on each control surface) sits in the boom and drives a crank on the spindle. If its hydraulic supply fails, a compensator keeps the actuator stiff and the flight controls reconfigure to fly on the remaining surfaces (Flight International, 1997).',
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
      explode: [-0.9, 2.0, 1.1 * side], callout: side > 0, anchor: [-2.0, 0.03, 2.9],
      desc: 'Each fin is canted 28° outward so neither presents a flat, vertical surface to a radar looking from the side. Together the two give about 16.5 m² of vertical tail area.',
    }, mesh(mergeGeometries(fin), F.wing())));
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
      system: 'Structure', material: 'Composite front and intermediate spars, titanium rear spar, composite ribs, titanium root fittings', mass: 140, explode: [-0.9, 1.4, 0.75 * side],
      desc: 'Spars and ribs make each fin a stiff torque box, bolted at its root to the aft boom. The rear spar was changed from composite to titanium during development to cure fin buffet at high angle of attack.',
    }, mesh(merge(g), F.composite())));

    // in the fin's local frame: chord along −x, span along +z, thickness along y
    const act = [new THREE.CylinderGeometry(0.028, 0.03, 0.56, 10).rotateX(Math.PI / 2).translate(-T.rootC * 0.64, 0, 0.36)];
    act.push(new THREE.BoxGeometry(0.18, 0.06, 0.16).translate(-T.rootC * 0.64, 0, 0.1));
    place(P(`Rudder actuator (${R})`, {
      system: 'Flight controls', material: 'Hydraulic actuator in the fin root', mass: 25, explode: [-1.4, 1.2, 1.0 * side],
      desc: 'A compact hydraulic actuator at the base of the fin drives the rudder through its lower hinge.',
    }, mesh(merge(act), F.hyd())));
  }

  // ================================================================== bay / well liners
  {
    const g = [];
    // side weapons bays (in the trunk walls)
    const stS = stations(FR.SIDE_BAY.s0, FR.SIDE_BAY.s1, 0.2);
    for (const side of [1, -1]) {
      g.push(cavityGrid(stS.map((s) => FR.sideBaySection(s).map(([zz, y]) => [X(s), y, side * zz]))));
      // countermeasure bay behind the side bay
      const stC = stations(FR.CM_BAY.s0, FR.CM_BAY.s1, 0.3);
      const edgeC = (s) => {
        const wf = FR.wallFractions(s);
        const a = FR.wallB(s, wf[5]), b = FR.wallB(s, wf[6]);
        return [[X(s), a[1], side * a[0]], [X(s), b[1], side * b[0]]];
      };
      g.push(cavity(stC, edgeC, () => [0, 0.05, -side * 1], 0.12));
    }
    // main-gear wells: a forward cavity over the leg slot (and a little ahead of it) for the trunnion, brace and
    // actuator, stepping out inboard aft of the weapons bay into the wheel bay, whose roof stays 2 cm under the
    // inlet duct's floor; the outboard wall runs 3 cm inside the trunk's side skin
    const stW = stations(W.cav0, W.s1, 0.12, [W.s0, W.sStep, W.sStep + 0.01, W.sNotch, W.sNotch + 0.01]);
    for (const side of [1, -1]) {
      g.push(cavityRows(stW.map((s) => {
        const D = FR.bD(s), yb = -D, yf = -D + 0.025;
        const open = s >= W.s0 - 1e-6;
        const zIn = FR.wellInWall(s);
        const yr = (z) => FR.mainWellRoof(s, z);
        const zoTop = FR.wellWallZ(s, yr(1.4)), zoBot = FR.wellWallZ(s, yf);
        const roof = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((u) => { const z = lerp(zoTop, zIn, u); return [z, yr(z)]; });
        const zm = lerp(zIn, zoBot, 0.5);
        const row = [open ? [FR.wellOuter(s), yb] : [zm, yf], [zoBot, yf], ...roof, [zIn, yf], open ? [FR.wellInner(s), yb] : [zm, yf]];
        return row.map(([z, y]) => [X(s), y, side * z]);
      })));
    }
    // nose-gear well: between the inlets, up to the underside of the cockpit floor
    const stN = stations(FR.NOSE_WELL.s0, FR.NOSE_WELL.s1, 0.2, [FR.NOSE_WELL.hump0, FR.NOSE_WELL.hump1]);
    const roof = () => -0.02;
    g.push(cavity(stN, (s) => [[X(s), FR.bottomAt(s, FR.NOSE_WELL.z), -FR.NOSE_WELL.z], [X(s), FR.bottomAt(s, FR.NOSE_WELL.z), FR.NOSE_WELL.z]], (s) => [0, roof(s) - FR.bottomAt(s, FR.NOSE_WELL.z), 0], 1));
    P('Side bay & gear-well liners', {
      system: 'Structure', material: 'Aluminium / composite liners', mass: 120, explode: [0, -0.35, 0],
      desc: 'Sealed liners form the two side weapons bays and the countermeasure bays in the inlet trunks and the three landing-gear wells, keeping airflow and moisture out of the fuselage when the doors open.',
    }, mesh(merge(g), F.bay()));
  }

  return { ringsA, ringsB, sA, sB };
}
