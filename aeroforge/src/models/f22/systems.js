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
const lefPdu = () => FR.lefPduAt();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Route points clamped inside the fuselage skin (the re-laid-out outer mould line). */
const inside = (pts, m = 0.03) => pts.map((p) => FR.inBody(p, m));
/** Out of the trunk into the wing root: up under the chine flange, where the wing joins it behind its leading edge. */
/** Out of the trunk into the wing root under the chine flange (shared with wiring.js, which runs the fly-by-wire
 *  6 cm aft of these lines and the power wiring 12 cm aft). */
const toWingRoot = (z, ds = 0) => [[8.3 + ds, -0.15, z * (FR.wallZ(8.3 + ds, -0.15) - 0.05)], [8.62 + ds, -0.05, z * 2.06], [8.78 + ds, -0.035, z * 2.17]];
/** Fin mid-plane at height y, and the rudder actuator's lower end in the fin root (airframe.js). */
const finMid = (y) => FR.FIN.rootZ + (y - FR.FIN.rootY) * Math.tan(FR.FIN.cant);
const rudderAct = () => [FR.FIN.rootS + 0.64 * FR.FIN.rootC, FR.FIN.rootY + 0.3 * Math.cos(FR.FIN.cant), FR.FIN.rootZ + 0.3 * Math.sin(FR.FIN.cant)];
const box = (s, y, z, ls, h, w) => FR.boxS(s, y, z, ls, h, w);
/** Airframe ends of the gear retraction actuators (gear.js) and the side-bay actuator roof fittings (weapons.js). */
const M_ACT = FR.MAIN_FIT.jack.fit;
const N_ACT = FR.NOSE_FIT.jack.fit;
const SB_TRAP = FR.M(10.6), SB_DOOR = FR.M(10.05);
const [SB_DOOR_Z, SB_DOOR_Y] = FR.wallB(SB_DOOR, FR.wallFractions(SB_DOOR)[4]);

/** Inlet duct centre and size (bounding box of the real air-passage section) at station s (right side). */
export function ductAt(s) {
  const sec = FR.ductSection(Math.min(Math.max(s, FR.DUCT[0][0]), FR.FAN_S));
  const zs = sec.map((p) => p[0]), ys = sec.map((p) => p[1]);
  const z0 = Math.min(...zs), z1 = Math.max(...zs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { zc: (z0 + z1) / 2, yc: (y0 + y1) / 2, w: z1 - z0, h: y1 - y0 };
}
/** Height of the duct's roof at (s, z) (its centre height outside the duct's width). */
export function ductTop(s, z) {
  const sp = FR.ductSpan(Math.min(Math.max(s, FR.DUCT[0][0]), FR.FAN_S), z);
  return sp ? sp.hi : ductAt(s).yc;
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

/** Closed tank loft from closed [z, y] outlines (any shape, same point count at every station), side ±1. */
function lobeLoft(st, outline, side = 1) {
  const rings = st.map((s) => outline(s).map(([z, y]) => [X(s), y, side * z]));
  if (side < 0) rings.forEach((r) => r.reverse());
  const g = FR.gridSurface(rings, { closed: true, uv: 'n' });
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
  let vol = 0;
  const area = (s) => { const h = outline(s); let a = 0; for (let k = 0; k < h.length; k++) { const [z1, y1] = h[k], [z2, y2] = h[(k + 1) % h.length]; a += z1 * y2 - z2 * y1; } return Math.abs(a) / 2; };
  for (let i = 0; i < st.length - 1; i++) vol += ((area(st[i]) + area(st[i + 1])) / 2) * (st[i + 1] - st[i]);
  return { geo: merge([g, ...caps]), vol };
}
/** Outermost z of the (right) inlet duct's air passage at height y, station s (null where the duct is not at y). */
function ductOuterAt(s, y) {
  const sec = FR.ductSection(s);
  if (!sec) return null;
  let zo = null;
  for (let k = 0; k < sec.length; k++) {
    const [z1, y1] = sec[k], [z2, y2] = sec[(k + 1) % sec.length];
    if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue;
    const z = z1 + ((y - y1) / (y2 - y1)) * (z2 - z1);
    if (zo === null || z > zo) zo = z;
  }
  return zo;
}
/**
 * Outboard fuel lobe at station s (right side): outboard of the inlet duct and over the side bay, out under the upper
 * skin and the chine flange to the trunk wall, down to y0. zIn: the lobe's inboard limit over the duct's crown (it
 * meets the saddle there); zCap: outboard limit (a dry bay — the gun's or the APU's — beyond it).
 */
function lobe(s, { y0 = -0.30, zIn = 0.9, zCap = 9, gap = 0.035, skin = 0.035 }) {
  const N = 9, out = [];
  // a corridor along the chine and the trunk wall stays free for the lines and wiring that run out into the wing root
  const zMax = Math.min(zCap, FR.bW(s) - 0.25);
  const zWall = (y) => Math.min(zMax, FR.wallZ(s, y) - 0.08);
  // (the duct's widest point within ±8 cm of y, so the edge between samples clears its rounded corners too)
  const zDuct = (y) => { let zo = null; for (let dy = -0.08; dy <= 0.0801; dy += 0.02) { const v = ductOuterAt(s, y + dy); if (v != null && (zo == null || v > zo)) zo = v; } return Math.max(zIn, zo == null ? zIn : zo + gap); };
  // inner edge, bottom → top (duct's outer wall), at the heights where the lobe has room
  const yTop = (z) => FR.topAt(s, z) - skin;
  let yHi = yTop(zIn);
  const inner = range(y0, yHi, N).map((y) => [Math.min(zDuct(y), zWall(y) - 0.04), Math.min(y, yTop(zDuct(y)) - 0.005)]);
  const top = range(inner[N][0], zMax, N).slice(1).map((z) => [z, Math.min(yTop(z), FR.topAt(s, z) - skin)]);
  const yC = top[top.length - 1][1];
  const outer = range(Math.min(yC, 0) - 0.001, y0, N).slice(1).map((y) => [zWall(y), y]);
  const bottom = range(zWall(y0), inner[0][0], 4).slice(1, -1).map((z) => [z, y0]);
  out.push(...inner, ...top, ...outer, ...bottom);
  return out;
}

/** "Saddle" tank cross-section over / between the inlet ducts. */
function saddle(s, { ybot, zo = 1.45, gapTop = 0.07, recess = null }) {
  const { zc, w } = ductAt(s);
  const zi = Math.max(0.08, zc - w / 2 - 0.05);
  let zO = Math.min(zo, zc + w / 2 - 0.12, FR.bW(Math.max(s, FR.S_AB)) - 0.45);
  const top = (z) => FR.topAt(s, z) - gapTop;
  // the underside follows the duct's real roof (highest wall point within ±5 cm), at least 3.5 cm above it
  const roof = (z) => { let h = ductTop(s, z); for (let dz = -0.05; dz <= 0.0501; dz += 0.025) { const sp = FR.ductSpan(s, z + dz); if (sp) h = Math.max(h, sp.hi); } return h; };
  const over = (z) => Math.max(roof(z) + 0.035, Math.min(roof(z) + 0.05, top(z) - 0.03));
  // (a recess in the top — the receptacle's well, the fuel coolers — never takes it down onto the duct: where the duct
  // climbs under the coolers' outboard edge the cell thins to 1 cm over its underside)
  const topR = (z) => Math.max(top(z) - (recess ? recess(z) : 0), Math.min(top(z), over(z) + 0.01));
  // only as far out over the duct as 3 cm of fuel depth remains (near the fan face the duct roof nears the deck)
  for (let z = zi; z <= zO; z += 0.01) if (top(z) - over(z) < 0.03) { zO = Math.max(zi + 0.01, z - 0.01); break; }
  const half = [];
  for (const z of range(0, zO, recess ? 14 : 7)) half.push([z, topR(z)]);
  for (const z of range(zO, zi, 12)) half.push([z, over(z)]);
  half.push([zi, ybot]);
  half.push([0, ybot]);
  return half;
}

/** A-3 cell outline (right side): the right half of the saddle over the duct's last metre, closed at z 0.03. */
function a3Outline(s) {
  const h = saddle(s, { ybot: -0.1, zo: 1.3 });
  const top0 = FR.topAt(s, 0.03) - 0.07;
  return [[0.03, top0], ...h.slice(1, -1), [0.03, -0.1]];
}
/**
 * A-1 cell outline (right side): beside the engine bay, from the engine's envelope (r 0.665 round its centre line,
 * over the external accessories) out to the trunk wall, from y −0.2 up to the upper skin — below the fin root where
 * the fin stands on the boom.
 */
function a1Section(s) {
  // (0.665 round the case and its external accessories; 6.5 cm off the narrower augmentor behind them, outside the fire
  // detector loops)
  const zc = FR.ENG_Z, yc = FR.ENG_Y, rE = lerp(0.665, FR.F119.rAug + 0.065, smooth(FR.AUG_S - 0.1, FR.AUG_S + 0.2, s)), sk = 0.035, yb = FR.FUEL.a1Floor;
  const zMax = FR.bW(s) - 0.12;
  const finCap = (z) => (s > FR.FIN.rootS - 0.05 && Math.abs(z - FR.FIN.rootZ) < 0.2 ? FR.FIN.rootY - 0.03 : 9);
  const yTop = (z) => Math.min(FR.topAt(s, z) - sk, finCap(z));
  const zEnv = (y) => zc + Math.sqrt(Math.max(0, rE * rE - (y - yc) * (y - yc)));
  // (a corridor along the trunk wall stays free for the lines and wiring that climb into the wing root behind it)
  const zWall = (y) => Math.min(zMax, FR.wallZ(s, y) - 0.08);
  // where the envelope meets the upper skin
  let lo = yb, hi = 0.6;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (yTop(zEnv(m)) > m) lo = m; else hi = m; }
  const yI = lo, N = 8, out = [];
  for (const y of range(yb, yI, N)) out.push([zEnv(y), y]);                                  // up the engine envelope
  const zT0 = zEnv(yI);
  for (const z of range(zT0, zMax, 12).slice(1)) out.push([z, yTop(z)]);                     // along the skin outboard
  const yC = Math.min(out[out.length - 1][1], 0);
  for (const y of range(yC, yb, N).slice(1)) out.push([zWall(y), y]);                        // down the trunk wall / flange
  for (const z of range(zWall(yb), zEnv(yb), 5).slice(1, -1)) out.push([z, yb]);             // inboard along the floor
  return out;
}

export function buildSystems(ctx) {
  const { P, anim } = ctx;
  const tanks = [];
  const EZ = FR.ENG_Z;

  // ================================================================== fuel
  // Cells as the rescue T.O. 00-105E-9 lists and draws them (A.11, fuel tank locations and quantities): F-1 (the
  // F-1A compartment behind the cockpit and the F-1B pump box, the forward feed cell), F-2 in the mid fuselage, the
  // small A-3 cells over the inlet ducts' last metre, the A-1 aft feed cells beside the engine bays, and the A-2
  // wing cells. Their outlines are not published: each is drawn filling the free space in the region the T.O.
  // shows, and its mass is its share of the published 18,000 lb (8,200 kg) by the T.O.'s capacities.
  const FT = FR.FUEL;
  const acfc = (s, z) => 0.22 * smooth(FR.ACFC.s0 - 0.08, FR.ACFC.s0, s) * (1 - smooth(FR.ACFC.s1, FR.ACFC.s1 + 0.08, s)) * smooth(FR.ACFC.z0 - 0.06, FR.ACFC.z0, z) * (1 - smooth(FR.ACFC.z1, FR.ACFC.z1 + 0.06, z));
  // F-1A: behind the cockpit over and between the inlets, under the air-cooled fuel coolers; its floor steps up over
  // the aft end of the nose-wheel well, where the leg's trunnion sits (FR.WELL_RESERVE.nose)
  const NW = FR.WELL_RESERVE.nose;
  const st1 = [...range(FT.f1a[0], NW.s1, 5), ...range(NW.s1 + 0.1, FT.f1a[1], 5)];
  const t1 = tankLoft(st1, (s) => {
    // (leaves a channel along the forebody side for the coolers' air, and stays 2 cm inboard of the inlet bleed plenum)
    const BL = FR.BLEED, nearBleed = smooth(BL.s0 - 0.12, BL.s0 - 0.02, s) * (1 - smooth(BL.s1 + 0.02, BL.s1 + 0.12, s));
    const zA = Math.min(FR.aW(s) - 0.18, lerp(9, FR.bleedPlenumZ() - BL.w / 2 - 0.02, nearBleed));
    const zs = [0, 0.08, 0.15, 0.2, 0.25, 0.32, ...range(0.4, zA, 4)];
    const half = zs.map((z) => [z, FR.topAt(s, z) - 0.07 - acfc(s, z)]);
    const step = (NW.y1Aft + 0.01 + 0.45) * (1 - smooth(NW.s1, NW.s1 + 0.1, s));
    half.push([Math.min(zA, FR.aLowerZ(s, -0.45) - 0.05), -0.45], [NW.z + 0.06, -0.45], [NW.z + 0.02, -0.45 + step], [0, -0.45 + step]);
    return half;
  });
  // F-1B pump box and F-2: saddles over and between the ducts, plus lobes outboard of the ducts over the side bays,
  // out to the trunk walls (the gun bay on the right and the APU bay on the left stay dry)
  const recWell = (s, z) => 0.24 * smooth(FR.AR.s0 - 0.04, FR.AR.s0 + 0.04, s) * (1 - smooth(FR.AR.s1 - 0.04, FR.AR.s1 + 0.04, s)) * (1 - smooth(0.17, 0.24, z));
  // (with the receptacle's well in F-2's top and the fuel coolers' recess in F-1B's, as in F-1A's)
  // and the inlet-bypass plenums, which stand on the ducts' roofs under the louvre doors: F-2 stops short of them
  const BPs = (s) => s > FR.BYPASS.s0 - 0.06 && s < FR.BYPASS.s1 + 0.06;
  const sad = (s, ybot) => saddle(s, { ybot, recess: (z) => recWell(s, z) + acfc(s, z), zo: BPs(s) ? FR.BYPASS.z0 - 0.03 : 1.45 });
  const lobeOpts = (s, side) => ({ y0: -0.30, zIn: Math.max(BPs(s) ? FR.BYPASS.z1 + 0.03 : 0, Math.min(1.45, ductAt(s).zc + ductAt(s).w / 2 - 0.12)), zCap: s > FT.gunBay ? 1.45 : 9 });
  const st1b = range(FT.f1b[0], FT.f1b[1], 7), st2 = range(FT.f2[0], FT.f2[1], 26);
  const t1b = tankLoft(st1b, (s) => sad(s, -0.27)), t2 = tankLoft(st2, (s) => sad(s, -0.27));   // (floors 3 cm over the runs along the bay ceiling)
  const lobes = [];
  for (const side of [1, -1]) {
    const L1 = lobeLoft(range(FT.f1b[0], FT.f1b[1] - 0.04, 7), (s) => lobe(s, lobeOpts(s, side)), side);
    const end = side > 0 ? FT.f2R : FT.f2L;
    const L2 = lobeLoft(range(FT.f2[0] + 0.04, end, Math.round((end - FT.f2[0]) / 0.11)), (s) => lobe(s, lobeOpts(s, side)), side);
    lobes.push({ L1, L2 });
  }
  // A-3: one small cell over each duct's last metre, between the duct roof and the deck
  const st3 = range(FT.a3[0], FT.a3[1], 4);
  const t3 = lobeLoft(st3, a3Outline, 1);
  // A-1: the aft feed cells beside each engine bay (T.O. plan: strips outboard of the engines from behind the main
  // wheel wells aft), wrapped round the titanium boom's box section
  const st4 = range(FT.a1[0], FT.a1[1], 6);
  const t4 = lobeLoft(st4, (s) => a1Section(s), 1);
  // wing tanks between the front and rear spars out to about 90 % of the semi-span (T.O. A.10 / A.11), a band inset from
  // the skins (FUEL.wingK of the local thickness) sized to the T.O.'s 375.3 US gal; inboard of the main-gear door's hinge rib the
  // wing root between the 36 % and 49 % spars is the wheel well (and the door actuator's dry bay), so the cell steps
  // round it there (and stays clear of the shallow pocket under the doors' forward teeth, ahead of the 36 % spar)
  const wingTank = () => {
    const piece = (z0, z1, c0, c1, nz) => {
      const zs = range(z0, z1, nz), fs = range(c0, c1, 7);
      const rings = zs.map((z) => {
        const sec = FR.wingSection(z);
        const pts = [];
        for (const f of fs) pts.push([sec.le[0] - f * sec.chord, sec.le[1] + naca00(f, sec.t) * sec.chord * FT.wingK, z]);
        for (const f of [...fs].reverse()) pts.push([sec.le[0] - f * sec.chord, sec.le[1] - naca00(f, sec.t) * sec.chord * FT.wingK, z]);
        return pts;
      });
      const area = (z) => { const sec = FR.wingSection(z); let a = 0; for (let k = 0; k < fs.length - 1; k++) a += (fs[k + 1] - fs[k]) * sec.chord * 2 * naca00((fs[k] + fs[k + 1]) / 2, sec.t) * sec.chord * FT.wingK; return a; };
      let vol = 0;
      for (let i = 0; i < zs.length - 1; i++) vol += ((area(zs[i]) + area(zs[i + 1])) / 2) * (zs[i + 1] - zs[i]);
      return { geo: FR.gridSurface(rings, { closed: true, uv: 'n' }), vol };
    };
    const zN = FR.MAIN_WELL.hingeZ + 0.1;     // (the hinge rib and the door actuator's dry bay outboard of the hinge)
    const ps = [piece(FT.wingZ0, zN, FT.wingC[0], 0.325, 1), piece(FT.wingZ0, zN, 0.50, FT.wingC[1], 1), piece(zN, FR.WING.kinkZ, FT.wingC[0], FT.wingC[1], 10), piece(FR.WING.kinkZ, FT.wingZ1, FT.wingC[0], FT.wingC[1], 2)];
    return { geo: merge(ps.map((p) => p.geo)), vol: ps.reduce((a, p) => a + p.vol, 0) };
  };
  const tw = wingTank();
  // T.O. capacities (US gal); each cell's mass is the modelled cell's volume full of JP-8 (0.80 kg/L)
  const CAP = { f1a: 380.8, f1b: 323.6, f2: 710.8, a3: 77.3, a1: 380.8, a2: 375.3 };
  const JP8 = 800;                                   // kg/m³
  const lit = (gal) => Math.round(gal * 3.78541 / 5) * 5;
  const volF2 = t2.vol + lobes.reduce((a, l) => a + l.L2.vol, 0), volF1b = t1b.vol + lobes.reduce((a, l) => a + l.L1.vol, 0);
  const vols = { f1a: t1.vol, f1b: volF1b, f2: volF2, a3: t3.vol, a1: t4.vol, a2: tw.vol };
  const kgV = (m3) => Math.round((m3 * JP8) / 5) * 5;
  if (typeof process !== 'undefined' && process.env && process.env.F22_FUEL) console.log('fuel volumes m3', JSON.stringify(vols));
  ctx.fuel = { kg: [kgV(vols.f1a), kgV(vols.f1b), kgV(vols.f2), kgV(vols.a3), kgV(vols.a1), kgV(vols.a2)], vols, capGal: CAP };
  const fuelMat = F.tank();
  // (the T.O.'s capacities add up to 3,082 US gal, ≈ 9,300 kg of JP-8, more than the published 18,000 lb / 8,200 kg
  // usable internal fuel; the cells are drawn toward the T.O.'s capacities)
  const tdesc = (gal, where, role, m3, note = '') => `${where} ${role} T.O. 00-105E-9 gives ${gal} US gal (${lit(gal).toLocaleString('en-US')} L, ${(gal * 0.00378541).toFixed(2)} m³); the cell's outline is not published, and the model's cell, drawn where the T.O. puts it, holds ≈ ${m3.toFixed(2)} m³ (${Math.round((m3 / (gal * 0.00378541)) * 100)} % of it)${note}. Its mass is that volume of JP-8 at 0.80 kg/L. (The T.O.'s capacities add up to about 9,300 kg of JP-8, more than the published 18,000 lb / 8,200 kg of usable internal fuel.)`;
  tanks.push(P('Forward fuselage tank F-1A', {
    system: 'Fuel', material: 'Integral tank in the fuselage structure, nitrogen-enriched-air inerted', mass: kgV(vols.f1a),
    explode: [0.6, 1.9, 0],
    desc: tdesc(CAP.f1a, 'Behind the cockpit, over and between the inlets, under the air-cooled fuel coolers:', 'the forward compartment of F-1, a transfer cell.', t1.vol),
  }, mesh(t1.geo, fuelMat)));
  tanks.push(P('F-1B pump box (forward feed cell)', {
    system: 'Fuel', material: 'Integral tank over the ducts and the front of the main weapons bay, with boost pumps', mass: kgV(vols.f1b),
    explode: [0.3, 2.05, 0],
    desc: tdesc(CAP.f1b, 'The aft part of F-1, saddled over the inlet ducts and out over the side bays:', 'one of the three feed cells (with A-1 left and right) whose boost pumps keep the engines fed in any attitude.', volF1b, ': the model\'s ducts, sized for the engine\'s airflow, take part of the space it wraps round'),
  }, mesh(merge([t1b.geo, ...lobes.map((l) => l.L1.geo)]), fuelMat)));
  tanks.push(P('Centre fuselage tank (F-2)', {
    system: 'Fuel', material: 'Integral tank wrapped over the inlet ducts and the main weapons bay', mass: kgV(vols.f2),
    explode: [0, 2.15, 0], callout: false,
    desc: tdesc(CAP.f2, 'The largest cell, saddled over both inlet ducts and the main weapons bay and out over the side bays, with the air-refuelling receptacle in a well in its top:', 'a transfer cell; fuel is also the jet\'s main heat sink.', volF2, ': the model\'s ducts, sized for the engine\'s airflow, take part of the space it wraps round'),
  }, mesh(merge([t2.geo, ...lobes.map((l) => l.L2.geo)]), fuelMat)));
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left';
    tanks.push(P(`A-3 tank (${R})`, {
      system: 'Fuel', material: 'Integral tank over the inlet duct', mass: kgV(vols.a3),
      explode: [-0.3, 2.0, 0.45 * side],
      desc: tdesc(CAP.a3, 'A small cell over the last metre of the inlet duct, where it drops to the engine face:', 'a transfer cell.', t3.vol, ': the model\'s ducts, sized for the engine\'s airflow, the bleed-air ducts and the APU start lines fill the space it would take between and over them (the real duct and cell shapes are not published)'),
    }, mesh(side > 0 ? t3.geo : mirror(t3.geo), fuelMat)));
    tanks.push(P(`A-1 aft feed tank (${R})`, {
      system: 'Fuel', material: 'Integral tank beside the engine bay, round the titanium boom, with a boost pump', mass: kgV(vols.a1),
      explode: [-0.6, 1.2, 1.1 * side],
      desc: tdesc(CAP.a1, 'Beside the engine bay, from behind the main wheel well aft:', `the ${R} aft feed cell, whose boost pump feeds the ${R} engine.`, t4.vol, ': the rest of the space the T.O. draws beside the engine is taken by the lines, harnesses and engine accessories the model routes there'),
    }, mesh(side > 0 ? t4.geo : mirror(t4.geo), fuelMat)));
    tanks.push(P(`Wing tank A-2 (${R})`, {
      system: 'Fuel', material: 'Integral (wet) wing box, sealed', mass: kgV(vols.a2),
      explode: [0, 0.8, 2.55 * side],
      desc: `${tdesc(CAP.a2, 'The wing box itself is the tank, between the front and rear spars from the root out to about 90 % of the semi-span (T.O. fuel plan and 3-D view), a band inset from the skins:', 'a transfer cell.', tw.vol)} Two 600 US gal (2,270 L) tanks can be hung on the inboard hardpoints for ferry flights, at the cost of stealth.`,
    }, mesh(side > 0 ? tw.geo : mirror(tw.geo), fuelMat)));
  }
  // pumps: electric transfer pumps in the wing cells, F-1A and F-2 (the T.O.: transfer cells use gravity, ejector and
  // electric pumps); boost pumps in the three feed cells, F-1B and the two A-1 cells
  const A1P = (side) => [FT.a1[0] + 0.12, -0.15, side * 1.4];
  {
    const g = [];
    for (const side of [1, -1]) {
      // (on the cell's floor aft of the main-gear well, between the 49 % spar and the 62 % spar)
      const sec = FR.wingSection(2.3), yLo = sec.le[1] - naca00(0.555, sec.t) * sec.chord;     // (the lower skin)
      g.push(FR.cylX(FR.SN - (sec.le[0] - 0.555 * sec.chord), yLo + 0.052, side * 2.3, 0.22, 0.05, 0.05, 14));
    }
    g.push(FR.cylX(FT.f2[0] + 1.6, -0.14, 0.05, 0.22, 0.05, 0.05, 14), FR.cylX(FT.f1a[0] + 0.85, -0.4, -0.12, 0.22, 0.05, 0.05, 14));   // (on F-1A's floor, behind the nose-well reserve)
    P('Fuel transfer pumps', {
      system: 'Fuel', material: 'Electrically driven centrifugal pumps', mass: 24, count: 4,
      explode: [0, 1.0, 0.9],
      desc: 'Pumps in the wing cells, F-1A and F-2 move fuel toward the three feed cells in a set sequence, helped by gravity and ejector pumps, so the centre of gravity stays where the flight controls expect it as fuel burns off.',
    }, mesh(merge(g), F.orange()));
    const b = [];
    for (const z of [0.1, -0.1]) b.push(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 14).translate(X(FT.f1b[0] + 0.3), -0.23, z), box(FT.f1b[0] + 0.3, -0.28, z, 0.1, 0.04, 0.1));   // on the cell's floor
    for (const side of [1, -1]) { const p = A1P(side); b.push(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14).translate(X(p[0]), p[1] + 0.035, p[2]), box(p[0], p[1] - 0.01, p[2], 0.1, 0.03, 0.1)); }
    P('Feed-tank boost pumps', {
      system: 'Fuel', material: 'Submerged electric boost pumps with ejector pumps', mass: 24, count: 4,
      explode: [-0.6, 0.7, 0],
      desc: 'Submerged at the bottom of the three feed cells — two in the F-1B pump box, one in each A-1 cell beside the engines — they push fuel at positive pressure into the engine feed lines so the engine pumps never cavitate, even at high altitude or under negative g.',
    }, mesh(merge(b), F.orange()));
  }
  {
    // transfer lines: between neighbouring cells, the wing cells into F-2 and A-1, A-3 back over the engine to A-1,
    // and the forward system's feed from F-1B aft to the A-1 cells along the keel slot
    const g = [];
    const top = (sv, zz, d = 0.05) => FR.topAt(sv, zz) - d;
    g.push(FR.pipe([[FT.f1a[1] - 0.12, -0.3, 0.2], [FT.f1b[0] + 0.12, -0.25, 0.2]], 0.025, 6, 2));
    g.push(FR.pipe([[FT.f1b[1] - 0.12, -0.18, 0.07], [FT.f2[0] + 0.12, -0.16, 0.07]], 0.025, 6, 2));
    for (const side of [1, -1]) {
      const z = side;
      // F-2 aft into the A-3 cell, between the two ducts (out of both air paths) under the receptacle's well
      g.push(FR.pipe([[FT.f2[1] - 0.15, FR.FUEL.f2a3[1], z * FR.FUEL.f2a3[0]], [FT.a3[0] + 0.15, FR.FUEL.f2a3[1], z * FR.FUEL.f2a3[0]]], 0.022, 6, 2));
      // A-3 aft over the outboard top of the engine into A-1
      g.push(FR.pipe(inside([[FT.a3[1] - 0.15, top(FT.a3[1] - 0.15, 0.85, 0.1), z * 0.85], [FT.a3[1] + 0.2, top(FT.a3[1] + 0.2, 1.15), z * 1.15], [12.2, top(12.2, 1.22), z * 1.22], [FT.a1[0] + 0.2, top(FT.a1[0] + 0.2, 1.3, 0.08), z * 1.32]]), 0.022, 6, 16));
      // wing cell into A-1 at the wing root, and forward into F-2's lobe (under the gun on the right)
      const sec = FR.wingSection(2.15);
      g.push(FR.pipe([[FT.a1[0] + 0.15, -0.06, z * 2.13], [FT.a1[0] + 0.3, -0.08, z * 1.95]], 0.025, 6, 2));
      g.push(FR.pipe([[9.35, -0.1, z * 2.13], [9.33, -0.14, z * 1.97], [9.3, -0.19, z * 1.78], [9.25, -0.22, z * 1.45], [9.22, -0.2, z * 1.3]], 0.025, 6, 12));
    }
    P('Fuel transfer lines', {
      system: 'Fuel', material: 'Aluminium / titanium tubing', mass: 45,
      explode: [0, 1.25, 0],
      desc: 'Carry fuel between the cells: from the wing cells, F-1A, F-2 and the A-3 cells toward the three feed cells. The cells are interconnected so a damaged one can be isolated and the rest still feed both engines (routing approximate).',
    }, mesh(merge(g), F.pipe()));
    for (const side of [1, -1]) {
      const R = side > 0 ? 'right' : 'left', z = side;
      const p = A1P(side), ez = FR.ENG_Z * side;
      P(`Engine feed line (${R})`, {
        system: 'Fuel', material: 'Self-sealing titanium feed line with fire shut-off valve', mass: 8,
        explode: [-0.9, 0.2, 0.7 * side],
        desc: `Runs from the boost pump in the ${R} A-1 feed cell, down past the engine bay's firewall through a fire shut-off valve, to the engine-mounted fuel pump on the front of the gearbox.`,
      }, mesh(merge([FR.pipe([[p[0], p[1] - 0.02, p[2]], [p[0] + 0.1, -0.26, z * 1.33], [12.6, -0.5, z * 1.2], [12.43, -0.6, z * 1.06], [12.25, -0.63, z * 1.02], [12.1, -0.7, z * 0.92], [12.06, -0.76, z * 0.8], [12.07, -0.78, ez + z * 0.12]], 0.024, 6, 24),
        new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(X(12.6), -0.5, z * 1.2)]), F.pipe()));
    }
  }
  {
    // dorsal air-refuelling receptacle: slipway trough in its well in the top of F-2, the nozzle socket at its aft end,
    // and the pair of doors over it (T.O. #4280 / #4281)
    const g = [];
    const { s0, s1, z: zw } = FR.AR;
    const prof = (s) => [[zw, FR.topAt(s, zw) - 0.01], [zw - 0.03, FR.topAt(s, 0) - 0.24], [-zw + 0.03, FR.topAt(s, 0) - 0.24], [-zw, FR.topAt(s, zw) - 0.01]].map(([z, y]) => [X(s), y, z]);
    g.push(FR.gridSurface([prof(s0), prof((s0 + s1) / 2), prof(s1)], { closed: false, uv: 'n' }));
    g.push(FR.cylX(s1 - 0.08, FR.topAt(s1 - 0.08, 0) - 0.17, 0, 0.12, 0.05, 0.08, 14));
    P('Air-refuelling receptacle', {
      system: 'Fuel', material: 'Aluminium slipway and receptacle', mass: 25,
      explode: [0.2, 2.7, 0],
      desc: 'A USAF flying-boom receptacle on the spine over the mid fuselage, under a pair of doors (T.O. 00-105E-9 panel map), in its own well in the top of F-2; painted guide markings on the spine ahead of it lead the boom in. At full rate a tanker can refill the internal tanks in a few minutes.',
    }, mesh(merge(g), F.yellow()));
    const doors = [];
    for (const side of [1, -1]) {
      const grid = toothedGrid((s, u) => { const z = side * lerp(0.005, zw, u); return [X(s), FR.topAt(s, Math.abs(z)) + 0.003, z]; }, [s0, (s0 + s1) / 2, s1], { width: zw - 0.005 });
      const door = slab(grid, () => [0, -0.02, 0], V(0, 1, 0));
      const h = hinge(mesh(door, F.door()), V(X(s0), FR.topAt(s0, zw), side * zw), V(X(s1), FR.topAt(s1, zw), side * zw), V(X((s0 + s1) / 2), 0.7, 0), V(0, -1, 0));
      doors.push(h);
    }
    P('Air-refuelling door', {
      system: 'Skin & fairings', skin: true, material: 'Composite doors, saw-tooth edges', mass: 6, count: 2,
      explode: [0.2, 3.2, 0],
      desc: 'A pair of doors on the spine, hinged at their outer edges, opens to expose the receptacle and its lights and closes flush afterwards; their fore and aft edges are saw-toothed like every other door.',
    }, doors.map((h) => h.pivot));
    anim.arDoor = doors;
    // slipway floodlights in the walls of the receptacle well, lighting it for the boom operator at night
    const lens = [], lit = [];
    for (const zz of [-0.137, 0.137]) for (const sl of [s0 + 0.12, s1 - 0.22]) {          // (set into the well's side walls)
      const y = FR.topAt(sl, 0.15) - 0.07;
      lens.push(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2).translate(X(sl), y, zz));
      lit.push(new THREE.CircleGeometry(0.024, 12).rotateY(zz > 0 ? Math.PI : 0).translate(X(sl), y, zz - Math.sign(zz) * 0.011));
    }
    const arLamp = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff4dc, emissiveIntensity: 0.25, roughness: 0.4 });
    P('Air-refuelling lights', {
      system: 'Electrical', material: 'Slipway floodlights, 28 V DC', mass: 1, count: 4,
      explode: [0.2, 2.95, 0.4],
      desc: 'Floodlights set into the receptacle well light the slipway so the tanker\'s boom operator can see to plug in at night (count and positions approximate).',
    }, [mesh(merge(lens), F.lens()), mesh(merge(lit), arLamp, { cast: false })]);
    // refuel manifold: from the receptacle down into F-2 and along the spine under the upper skin to every cell, with
    // a branch into each wing cell beside the transfer line
    const m = [];
    const sp = (sv, zz = 0.06) => [sv, FR.topAt(sv, zz) - 0.035, zz];
    m.push(FR.pipe([[s1 - 0.02, FR.topAt(s1, 0) - 0.17, 0], [s1 + 0.06, FR.topAt(s1 + 0.06, 0) - 0.12, 0.04], sp(s1 + 0.1), sp(FT.a3[0] + 0.3), sp(11.6), sp(FT.a1[0] - 0.1)], 0.03, 6, 20));
    m.push(FR.pipe([[s1 - 0.1, FR.topAt(s1 - 0.1, 0) - 0.2, 0], [s1 - 0.1, 0.2, 0.02], [s1 - 0.12, 0.05, 0.02]], 0.024, 6, 6));            // into F-2
    m.push(FR.pipe([sp(s0 - 0.08), sp(s0 - 0.6), sp(FT.f1b[1] - 0.1), sp(FT.f1b[0] + 0.2), [FT.f1b[0] + 0.1, FR.topAt(FT.f1b[0] + 0.1, 0.06) - 0.12, 0.06]], 0.024, 6, 20));
    m.push(FR.pipe([[s0 - 0.08, FR.topAt(s0 - 0.08, 0.06) - 0.035, 0.06], [s0 + 0.02, FR.topAt(s0, 0) - 0.18, 0.04], [s0 + 0.06, FR.topAt(s0, 0) - 0.2, 0.0]], 0.024, 6, 6));
    for (const side of [1, -1]) m.push(FR.pipe(inside([sp(FT.a1[0] - 0.12), [FT.a1[0] - 0.08, FR.topAt(FT.a1[0] - 0.08, 0.2) - 0.035, side * 0.2], [FT.a1[0] - 0.05, FR.topAt(FT.a1[0], 0.75) - 0.04, side * 0.75], [FT.a1[0] + 0.1, FR.topAt(FT.a1[0] + 0.1, 1.0) - 0.06, side * 1.0]], 0.03), 0.022, 6, 12));   // (into A-1's inboard top corner, clear of the vent, inert-gas and transfer lines further out)
    for (const side of [1, -1]) m.push(FR.pipe([[9.42, -0.08, side * 2.13], [9.37, -0.18, side * 1.9], [9.33, -0.24, side * 1.45], [9.32, -0.2, side * 1.28]], 0.02, 6, 10));
    P('Refuelling manifold', {
      system: 'Fuel', material: 'Aluminium manifold with level-control shut-off valves', mass: 22,
      explode: [0.1, 2.35, 0],
      desc: 'Distributes fuel from the receptacle (or the ground pressure-refuelling point) to every cell; float-operated shut-off valves close each cell as it fills.',
    }, mesh(merge(m), F.pipe()));
    // single-point pressure-refuelling adapter on the forward wall of the right main wheel well, facing aft; its line
    // runs up inside the trunk side, aft of the gun bay, into the right A-3 cell
    const ga = [];
    // (on the well's front wall, ahead of the bulkhead web and the leg's trunnion)
    const wS = FR.MAIN_WELL.s0, wZ = 1.3;
    ga.push(new THREE.CylinderGeometry(0.05, 0.055, 0.06, 16).rotateZ(Math.PI / 2).translate(X(wS + 0.05), -0.6, wZ));
    ga.push(new THREE.BoxGeometry(0.03, 0.14, 0.14).translate(X(wS + 0.015), -0.6, wZ));
    ga.push(FR.pipe(inside([[wS + 0.015, -0.6, wZ], [wS - 0.03, -0.45, wZ + 0.05], [wS - 0.04, -0.18, wZ + 0.12], [wS - 0.06, 0.08, wZ], [FT.a3[0] + 0.25, FR.topAt(FT.a3[0] + 0.25, 1.05) - 0.12, 1.05]], 0.04), 0.022, 6, 24));
    P('Ground refuelling adapter', {
      system: 'Fuel', material: 'Single-point pressure-refuelling coupling with shut-off valve', mass: 5,
      explode: [0.3, -1.25, 1.5],
      desc: 'A ground crew refuels every cell through this one coupling on the forward wall of the right main wheel well, under pressure from a truck or hydrant, with the same level-control valves that stop each cell filling (position approximate).',
    }, mesh(merge(ga), F.yellow()));
  }
  {
    // quantity probes: capacitance probes standing in each cell, each 3 cm clear of the cell's top and bottom
    const g = [];
    const probe = (s, z, y0, y1) => { if (y1 - y0 > 0.06) g.push(new THREE.CylinderGeometry(0.012, 0.012, y1 - y0, 6).translate(X(s), (y0 + y1) / 2, z)); };
    probe(6.4, 0.35, -0.452, FR.topAt(6.4, 0.35) - 0.1);
    probe(7.42, -0.1, -0.305, FR.topAt(7.42, 0.1) - 0.1);
    for (const [sv, zz] of [[8.4, 0.09], [9.0, -0.09], [10.1, 0.09]]) probe(sv, zz, -0.262, FR.topAt(sv, Math.abs(zz)) - 0.1 - (sv > FR.AR.s0 - 0.1 && sv < FR.AR.s1 + 0.1 ? 0.26 : 0));
    for (const side of [1, -1]) {
      probe(8.0, side * 1.55, -0.37, FR.topAt(8.0, 1.55) - 0.07);
      probe(13.2, side * 1.8, -0.17, FR.topAt(13.2, 1.8) - 0.06);
      for (const z of [2.9, 3.5]) {
        const sec = FR.wingSection(z);
        const sx = sec.le[0] - 0.42 * sec.chord;
        const h = naca00(0.42, sec.t) * sec.chord * (FR.FUEL.wingK + 0.01);   // floor to roof of the wing cell (FUEL.wingK)
        g.push(new THREE.CylinderGeometry(0.01, 0.01, 2 * h, 6).translate(sx, sec.le[1], side * z));
      }
    }
    P('Fuel quantity probes', {
      system: 'Fuel', material: 'Capacitance gauging probes', mass: 8, count: 13,
      explode: [0, 2.9, 0.4],
      desc: 'Capacitance probes in every cell measure the fuel height (fuel and air have different permittivity); the fuel-management computer turns them into mass, which the up-front displays show (probe count illustrative).',
    }, mesh(merge(g), F.copper()));
  }
  {
    // vent system: a vent gallery along the spine from the cells' high points aft to the left A-1 cell and out
    // along the left wing's rear spar to the vent outlet under the left wing (T.O. bottom view: "fuel vent" at
    // s ≈ 13.1, z ≈ −3.5); dump line aft along the keel to the stinger between the nozzles
    const v = [], sv = (s, zz) => [s, FR.topAt(s, zz) - 0.035, zz];
    const wv = FR.wingSection(3.5), xv = 13.1, yv = FR.wingY(3.5) - naca00((xv - FR.wingLE(3.5)) / wv.chord, wv.t) * wv.chord + 0.012;
    // (round the outboard side of the refuelling receptacle's well, between the inert-gas line and fly-by-wire channel C)
    v.push(FR.pipe([sv(7.0, -0.1), sv(8.4, -0.1), sv(9.2, -0.1), sv(FR.AR.s0 - 0.12, -0.255), sv(FR.AR.s1 + 0.1, -0.255), sv(10.65, -0.12), sv(11.3, -0.12), sv(12.1, -0.16), [12.35, FR.topAt(12.35, 0.9) - 0.04, -0.9], [FT.a1[0] + 0.35, FR.topAt(FT.a1[0] + 0.35, 1.45) - 0.06, -1.45], [13.5, FR.topAt(13.5, 1.9) - 0.035, -1.95], [13.98, FR.wingY(2.3), -2.3], [13.98, FR.wingY(3.2), -3.2], [xv, FR.wingY(3.5) - 0.02, -3.5], [xv, yv + 0.02, -3.5]], 0.02, 6, 60));
    v.push(FR.cylX(xv, yv, -3.5, 0.08, 0.025, 0.02, 10));
    const d = [FR.pipe([[FT.a1[0] + 0.12, -0.15, -1.25], [12.7, -0.2, -1.2], [13.2, FR.topAt(13.2, 0.25) - 0.06, -0.06], [14.6, FR.topAt(14.6, 0.06) - 0.07, -0.06], [15.6, 0.15, -0.05], [16.6, 0.0, 0.0], [17.3, -0.06, 0.0], [17.42, -0.07, 0.0]], 0.025, 6, 40), FR.cylX(17.46, -0.07, 0, 0.1, 0.03, 0.025, 10)];
    P('Fuel vent & dump system', {
      system: 'Fuel', material: 'Titanium vent lines, vent outlet under the left wing, dump line to the stinger', mass: 18,
      explode: [-1.0, -0.2, 0],
      desc: 'Vent lines keep the cells\' pressure in limits as fuel is used and altitude changes, venting through an outlet under the left wing (T.O. 00-105E-9 bottom view); a dump line runs aft along the keel to the tail stinger between the nozzles so fuel can be jettisoned to reach a safe landing weight (dump outlet position approximate).',
    }, mesh(merge([...v, ...d]), F.pipe()));
  }
  {
    // OBIGGS: an air-separation module in the ECS bay strips oxygen from bleed air; nitrogen-enriched air goes along
    // the spine to the ullage of every cell (T.O.: all cells are pressurised through the vent and pressurisation
    // valve connected to the OBIGGS)
    const E = FR.ECS_BAY;
    const g = [FR.cylX(E.asm[0], E.asm[1], E.asm[2], 0.5, 0.075, 0.075, 16), FR.cylX(E.asm[0] - 0.28, E.asm[1], E.asm[2], 0.06, 0.09, 0.09, 16)];
    const l = [];
    const sp = (s, zz = -0.06) => [s, FR.topAt(s, Math.abs(zz)) - 0.035, zz];
    l.push(FR.pipe([[E.asm[0] + 0.25, E.asm[1], E.asm[2]], [E.asm[0] + 0.3, E.asm[1] + 0.12, E.asm[2] * 0.6], [6.86, -0.42, -0.12], [6.92, -0.32, -0.08], [7.0, 0.1, -0.06], sp(7.2), sp(7.45), sp(7.7), sp(8.0), sp(9.0), sp(FR.AR.s0 - 0.15), sp(FR.AR.s0 - 0.08, -0.2), sp(FR.AR.s1 + 0.08, -0.2), sp(FR.AR.s1 + 0.15), sp(11.0), sp(11.8), sp(FT.a1[0] - 0.15, -0.2)], 0.014, 5, 60));
    // drops into F-1A, F-1B, F-2, A-3 and both A-1 cells' ullage, and branches to the wing cells along the refuel branches
    for (const [s, zz] of [[6.5, -0.06], [7.3, -0.06], [8.6, -0.06], [11.0, -0.06]]) l.push(FR.pipe([sp(s, zz), [s, FR.topAt(s, 0.06) - 0.13, zz]], 0.01, 5, 2));
    for (const side of [1, -1]) {
      // (into A-1's inboard top corner, just aft of the refuelling manifold's branch and inboard of the vent)
      l.push(FR.pipe(inside([sp(FT.a1[0] - 0.15, -0.2).map((v, k) => (k === 2 ? side * 0.2 : v)), [FT.a1[0] + 0.05, FR.topAt(FT.a1[0] + 0.05, 0.55) - 0.09, side * 0.55], [FT.a1[0] + 0.17, FR.topAt(FT.a1[0] + 0.17, 0.95) - 0.075, side * 0.95]], 0.03), 0.01, 5, 10));
      l.push(FR.pipe([[9.5, -0.09, side * 2.13], [9.45, -0.2, side * 1.9], [9.42, -0.26, side * 1.45], [9.4, -0.22, side * 1.3]], 0.01, 5, 10));
    }
    P('Inert-gas generating system (OBIGGS)', {
      system: 'Fuel', material: 'Hollow-fibre air-separation module, distribution lines', mass: 30,
      explode: [0.6, -1.65, 0],
      desc: 'An air-separation module passes engine bleed air through hollow fibres that let oxygen escape, leaving nitrogen-enriched air that pressurises the space above the fuel in every cell through the vent and pressurisation valve (T.O. 00-105E-9), so a hit cannot ignite the vapour (module position approximate).',
    }, [mesh(merge(g), F.boxLight()), mesh(merge(l), F.pipe())]);
  }

  // ================================================================== hydraulics: two independent 4,000 psi systems
  // pumps on each AMAD's aft face; reservoir, accumulators and pressure-filter manifold on the inboard wall of that
  // side's main wheel well (T.O. 00-105E-9: "accumulators are in main wheel wells"; reservoir, flight-control
  // accumulator and pressure filter manifold drawn there); galleries forward along the main-bay sill, aft under the
  // engine bay to the tail, out along the rear spar to the trailing-edge actuators
  const AM = FR.AMAD, RT = FR.ROUTE;
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left', S = side > 0 ? 'A' : 'B', z = side;
    const g = [];
    for (const pz of RT.pumpZ) {
      g.push(FR.cylX(AM.s1 + 0.11, AM.y + 0.005, z * pz, 0.18, 0.055, 0.05, 14));
      g.push(box(AM.s1 + 0.02, AM.y + 0.005, z * pz, 0.04, 0.12, 0.12));                    // mounting pad on the AMAD
    }
    P(`Hydraulic pumps (${R} AMAD)`, {
      system: 'Hydraulics', material: 'Eaton PV3-115 variable-displacement piston pumps', mass: 32, count: 2,
      explode: [-0.1, -1.0, 1.0 * side],
      desc: `Engine-driven pumps on the aft face of the ${R} accessory drive pressurise ${side > 0 ? 'system A' : 'system B'} at 4,000 psi (27.6 MPa) — higher than the usual 3,000 psi, so actuators and lines can be smaller and lighter. Eaton's PV3-115 was qualified for this duty with an 8,000-hour design life; the number of pumps per AMAD is not published (two are drawn). The T.O. lists about 35 US gal of hydraulic fluid in the jet.`,
    }, mesh(merge(g), F.hyd()));
    const W = RT.wellWall;
    P(`Hydraulic reservoir (system ${S})`, {
      system: 'Hydraulics', material: 'Bootstrap (self-pressurising) piston reservoir on brackets from the well wall', mass: 15,
      explode: [0.1, -1.25, 0.55 * side],
      desc: `System ${S} has its own pressurised reservoir, mounted with the accumulators on the inboard wall of the ${R} main wheel well (T.O. 00-105E-9), so a leak in one system cannot drain the other. A bootstrap piston keeps the fluid under pressure so the pumps are fed at any altitude or attitude.`,
    }, mesh(merge([FR.cylX(W.resS, W.y, z * W.resZ, 0.42, 0.075, 0.075, 14), FR.cylX(W.resS + 0.25, W.y, z * W.resZ, 0.08, 0.045, 0.045, 10),
      ...[-0.13, 0.13].map((ds) => box(W.resS + ds, W.y, z * (W.resZ - 0.07), 0.04, 0.05, 0.06))]), F.hyd()));
    P(`Hydraulic accumulators (system ${S})`, {
      system: 'Hydraulics', material: 'Nitrogen-charged steel accumulators on a bracket, with the pressure-filter manifold', mass: 10,
      explode: [0.2, -1.45, 0.3 * side],
      desc: `A gas-charged accumulator on system ${S} smooths pump ripple and supplies peak flow when several actuators move at once; a second one serves the flight controls, and the pressure-filter manifold beside them cleans the pump output (T.O. 00-105E-9 draws all three in the main wheel well).`,
    }, mesh(merge([new THREE.SphereGeometry(0.075, 14, 10).translate(X(W.accS), W.accY, z * W.accZ), new THREE.SphereGeometry(0.06, 14, 10).translate(X(W.accS + 0.17), W.accY, z * W.accZ),
      box(W.accS + 0.085, W.accY, z * (W.accZ - 0.08), 0.3, 0.05, 0.03),
      box(W.filS, W.filY, z * W.resZ, 0.12, 0.05, 0.1)]), F.steel()));
  }
  P('Brake & emergency accumulator', {
    system: 'Hydraulics', material: 'Nitrogen-charged steel accumulator', mass: 6,
    explode: [0.2, -1.6, 0],
    desc: 'On a cross-beam between the keel longerons, between the main wheel wells, it holds a reserve of pressurised fluid for the wheel brakes if both pumps are lost; emergency gear extension uses air from the stored-energy system\'s bottles instead (T.O. 00-105E-9).',
  }, mesh(merge([new THREE.CapsuleGeometry(0.06, 0.18, 4, 10).rotateZ(Math.PI / 2).translate(X(RT.brakeAcc[0]), RT.brakeAcc[1], 0), box(RT.brakeAcc[0], RT.brakeAcc[1] - 0.06, 0, 0.06, 0.04, 0.4)]), F.steel()));
  for (const side of [1, -1]) {
    const z = side, S = side > 0 ? 'A' : 'B';
    const W = RT.wellWall, g = [];
    const pumpOut = RT.pumpZ.map((pz) => [AM.s1 + 0.19, AM.y + 0.005, z * pz]);
    const man = [W.filS, W.filY, z * W.resZ];
    // pumps → filter manifold → reservoir and accumulators
    for (const p of pumpOut) g.push(FR.pipe([p, [p[0] + 0.05, -0.8, p[2]], [W.filS + 0.08, man[1] - 0.02, z * (W.resZ - 0.02)], [man[0] + 0.06, man[1], man[2]]], 0.014, 5, 10));
    g.push(FR.pipe([[man[0] - 0.06, man[1], man[2]], [W.resS + 0.3, W.y + 0.06, z * W.resZ], [W.resS + 0.29, W.y + 0.04, z * W.resZ]], 0.014, 5, 6));
    g.push(FR.pipe([[man[0] - 0.03, man[1] + 0.005, z * (W.resZ + 0.035)], [W.accS + 0.31, W.accY - 0.07, z * (W.accZ - 0.075)], [W.accS + 0.3, W.accY - 0.03, z * (W.accZ - 0.05)], [W.accS + 0.17, W.accY - 0.03, z * (W.accZ - 0.03)]], 0.014, 5, 8));
    // forward gallery: along the well's inboard wall, over the ammunition container, then the main-bay sill to the
    // front of the side bay, round it and up under the chine into the wing root to the LEF power drive unit
    const hy = RT.sill.hyd;
    const fwd = [[man[0] - 0.02, man[1] + 0.02, man[2]], [W.resS - 0.05, -0.66, z * 1.05], [FR.AMMO.s1 + 0.05, -0.66, z * 1.05], [FR.MAIN_BAY.s1, hy[1], z * hy[0]], [8.6, hy[1], z * hy[0]], [7.05, hy[1], z * hy[0]], [6.94, -0.5, z * 1.25], [6.935, -0.42, z * 1.62], [7.4, -0.24, z * (FR.wallZ(7.4, -0.24) - 0.05)]];
    g.push(FR.pipe([...inside(fwd), ...toWingRoot(z), [lefPdu()[0] - 0.48, lefPdu()[1] - 0.03, z * (lefPdu()[2] - 0.1)], [lefPdu()[0] - 0.05, lefPdu()[1], z * (lefPdu()[2] - 0.08)]], 0.016, 5, 90));
    // aft gallery under the engine bay's outboard side, up into the boom to the stabilator actuator and into the fin
    // root to the rudder actuator (behind the A-1 tank)
    const aft = [[man[0] + 0.05, man[1] - 0.02, man[2]], [12.5, -0.76, z * 1.06], [13.2, -0.68, z * 1.14], [14.2, -0.56, z * 1.27], [14.95, -0.45, z * 1.34], [15.25, -0.3, z * 1.42]];
    g.push(FR.pipe([...inside(aft), [15.45, -0.24, z * 1.55], [FR.STAB.pivotS - 0.95, -0.22, z * 1.6]], 0.016, 5, 40));
    { const [rs, ry, rz] = rudderAct(); g.push(FR.pipe([...inside([[15.25, -0.3, z * 1.42], [15.32, 0.0, z * 1.42]]), [15.36, 0.2, z * finMid(0.2)], [rs - 0.05, ry, z * rz]], 0.014, 5, 20)); }
    // out along the rear spar to the flaperon and aileron actuators (one actuator per surface): up the trunk wall
    // just behind the rear spar's frame and into the wing root's trailing-edge bay
    const fl = FR.teActuator('flaperon'), ai = FR.teActuator('aileron'), sR = RT.rearSpar;
    g.push(FR.pipe([...inside([[14.2, -0.56, z * 1.27], [sR, -0.5, z * 1.55], [sR, -0.3, z * (FR.wallZ(sR, -0.3) - 0.04)], [sR, -0.16, z * (FR.wallZ(sR, -0.16) - 0.04)]]), [sR, FR.wingY(2.3) - 0.05, z * 2.3], [sR, fl.y, z * (fl.z - 0.12)], [fl.s1 - 0.12, fl.y, z * (fl.z - 0.035)]], 0.014, 5, 40));
    g.push(FR.pipe([[sR, fl.y, z * (fl.z - 0.12)], [sR, FR.wingY(4.0), z * 4.0], [sR - 0.01, FR.wingY(ai.z - 0.25), z * (ai.z - 0.25)], [ai.s1 - 0.03, ai.y, z * (ai.z - 0.03)]], 0.012, 5, 30));
    // crossfeed: each system also reaches the other side's stabilator and rudder actuators, under the keel aft
    g.push(FR.pipe(inside([[14.95, -0.45, z * 1.34], [15.05, -0.6, z * 0.9], [15.1, -0.66, z * 0.2], [15.12, -0.66, -z * 0.2], [15.17, -0.6, -z * 0.9], [15.25, -0.32, -z * 1.4]]), 0.012, 5, 24));
    P(`Hydraulic lines (system ${S})`, {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi)', mass: 35,
      explode: [0, -0.6, 0.35 * side],
      desc: `System ${S} lines run from the ${side > 0 ? 'right' : 'left'} pumps through the filter manifold in the wheel well to the stabilator, rudder, flaperon, aileron and leading-edge-flap actuators and the weapons-bay doors and launchers. The F-22 has two independent 4,000 psi systems but only one actuator on each control surface (Flight International, 1997); which system feeds which actuator is not published, so the crossfeed to the far tail is approximate.`,
    }, mesh(merge(g), F.hyd()));
  }
  {
    const g = [];
    const hy = RT.sill.hyd;
    for (const side of [1, -1]) {
      // main gear: off the filter manifold at the back of the well, down behind the reservoir to the retraction
      // jack's head at its fitting on the gear beam, and the brake line from the gallery at the front of the well to
      // the leg's aft trunnion bearing, where a swivel joint takes it onto the strut
      const W = RT.wellWall;
      g.push(FR.pipe([[W.filS + 0.025, W.filY - 0.005, side * (W.resZ + 0.03)], [M_ACT[0] + 0.025, -0.74, side * 1.13], [M_ACT[0] + 0.02, -0.84, side * 1.16], [M_ACT[0] + 0.01, M_ACT[1] + 0.04, side * (M_ACT[2] - 0.04)], [M_ACT[0], M_ACT[1] + 0.03, side * (M_ACT[2] - 0.015)]], 0.012, 5, 16));
      const bA = FR.gearRotation('main', 0, side), kk = bA.k, b1 = FR.MAIN_FIT.bearing[1];
      const brg = [bA.T[0] + kk[0] * b1, bA.T[1] + kk[1] * b1, bA.T[2] + kk[2] * b1];
      g.push(FR.pipe([[FR.AMMO.s1 + 0.2, -0.66, side * 1.05], [11.42, -0.64, side * 0.97], [brg[0] + 0.04, brg[1] + 0.09, side * 1.0], [brg[0] + 0.03, brg[1] + 0.05, brg[2] - side * 0.05]], 0.01, 5, 10));
    }
    // nose gear: from system A's gallery at the front of the main bay, inboard over the bay's front bulkhead,
    // forward under the ECS bay and along the outside of the nose well's right wall (turning in to it where the lower
    // forward fuselage narrows) to the retraction jack's fitting under the cockpit floor
    {
      const NY = RT.nose.hyd, sl = RT.nose.slot, NW = FR.NOSE_WELL;
      g.push(FR.pipe([[7.2, hy[1], hy[0]], [7.05, NY[1] + 0.02, 1.07], [sl + 0.02, NY[1] + RT.nose.slotDrop, 1.0], [sl, NY[1] + RT.nose.slotDrop, 0.75], [sl - 0.02, NY[1], NY[0]], [6.0, NY[1], NY[0]], [4.95, NY[1], NY[0]], [4.85, -0.645, 0.40], [4.74, -0.63, NW.wall + 0.03], [4.68, -0.4, NW.wall + 0.03], [4.65, -0.15, NW.wall + 0.025], [N_ACT[0], -0.1, N_ACT[2] + 0.04]], 0.012, 5, 50));
    }
    P('Landing-gear & brake hydraulic lines', {
      system: 'Hydraulics', material: 'Titanium and steel tubing, flexible hoses across the gear pivots', mass: 18,
      explode: [0.3, -1.55, 0],
      desc: 'Utility lines to the gear actuators, door jacks, nose-wheel steering and wheel brakes: each main-gear retraction line leaves its system\'s filter manifold at the back of the wheel well and the brake line its gallery at the front, the nose-gear line runs from the gallery round the front of the main bay and forward beside the nose well; flexible hoses cross each trunnion (routing approximate).',
    }, mesh(merge(g), F.hyd()));
  }

  {
    // weapons branches off each system's bay-sill gallery: door drive, the three AVELs (hydropneumatic launchers;
    // how they draw on aircraft hydraulics is not published, so these stubs are approximate), the side-bay
    // trapeze and door, and the gun drive
    const g = [];
    const hy = RT.sill.hyd, BD = FR.BAY_DRIVE;
    for (const side of [1, -1]) {
      const z = side;
      g.push(FR.pipe([[BD.pdu + 0.2, hy[1], z * hy[0]], [BD.pdu + 0.21, -0.68, z * (hy[0] + 0.005)], [BD.pdu + 0.22, -0.76, z * (hy[0] - 0.01)], [BD.pdu + 0.23, BD.y + 0.035, z * (BD.z + 0.01)]], 0.008, 5, 8));          // door drive PDU's motor (outboard of the main harness)
      // up the bay's aft bulkhead and along the ceiling into each AVEL hanger's hydraulic fitting
      const sH = FR.AMRAAM_S - 0.13 + 0.95;
      g.push(FR.pipe([[sH, hy[1], z * hy[0]], [sH, FR.bayCeil(0.97) + 0.02, z * 0.99], [sH, FR.bayCeil(0.8) + 0.025, z * 0.8], [sH, FR.BAY_CEIL + 0.025, z * 0.5], [sH, FR.BAY_CEIL + 0.025, z * 0.2]], 0.007, 5, 24));
      for (const [zz] of FR.AMRAAM_SLOTS) g.push(FR.pipe([[sH, FR.bayCeil(zz) + 0.022, z * zz], [sH, FR.bayCeil(zz) - 0.012, z * zz]], 0.006, 5, 2));
      // to the side bay: up inboard of the bleed duct, over it and out over the side-bay roof (under the F-2 lobe)
      // to the trapeze actuator's and the door actuator's roof fittings
      const yS = -0.33, roofY = (sv, zz) => { const [a, aIn] = FR.sideBaySection(sv); return FR.lerp(aIn[1], a[1], (zz - aIn[0]) / (a[0] - aIn[0])); };
      g.push(FR.pipe([[SB_TRAP + 0.06, hy[1], z * hy[0]], [SB_TRAP + 0.11, -0.52, z * 1.02], [SB_TRAP + 0.11, -0.42, z * 1.05], [SB_TRAP + 0.1, yS, z * 1.12], [SB_TRAP + 0.08, yS, z * 1.3], [SB_TRAP + 0.05, yS, z * 1.39], [SB_TRAP + 0.02, roofY(SB_TRAP, 1.4) - 0.005, z * 1.4]], 0.008, 5, 16));
      g.push(FR.pipe([[SB_TRAP + 0.05, yS, z * 1.39], [SB_DOOR + 0.1, yS, z * 1.4], [SB_DOOR + 0.02, roofY(SB_DOOR, 1.43) - 0.005, z * 1.43]], 0.007, 5, 12));
    }
    // gun drive, from system A's gallery behind the side bay up the outboard side of the right duct
    g.push(FR.pipe([[10.45, hy[1], hy[0]], [10.5, -0.45, 1.25], [10.5, -0.2, 1.52], [10.52, 0.0, 1.6], [10.55, 0.04, 1.6]], 0.008, 5, 24));
    g.push(FR.pipe([[10.5, hy[1] - 0.03, hy[0]], [10.56, -0.47, 1.27], [10.6, -0.22, 1.54], [10.63, 0.0, 1.62], [10.65, 0.04, 1.62]], 0.008, 5, 24));
    P('Weapons hydraulic branch lines', {
      system: 'Hydraulics', material: 'Titanium tubing (4,000 psi), swivel joints at the moving launchers', mass: 9, xrayWeight: 0.7,
      explode: [0.2, -1.75, 0.35],
      desc: 'Branches off the bay-sill galleries feed the main-bay door drives, the side-bay trapeze and door actuators, the M61A2 gun drive and stubs to the three AVELs on each side (the AVEL is hydropneumatic; how it draws on aircraft hydraulics is not published). The 4,000 psi system runs the rudders, landing gear, nose-wheel steering, flight controls and the weapons alike.',
    }, mesh(merge(g), F.hyd()));
  }

  // ================================================================== electrical
  for (const side of [1, -1]) {
    const R = side > 0 ? 'right' : 'left', z = side;
    P(`Generator (${R})`, {
      system: 'Electrical', material: 'Brushless 270 V DC generator, oil cooled, on the AMAD\'s forward face', mass: 40,
      explode: [0.45, -1.05, 1.05 * side],
      desc: 'Driven by the accessory drive behind it, it supplies the 270 V DC primary bus. A high-voltage DC system saves copper weight; development-era figures give about 157 kW of primary and auxiliary electrical power in total.',
    }, mesh(merge([FR.cylX(AM.s0 - 0.14, AM.y + 0.005, z * AM.z, 0.24, 0.085, 0.09, 18), box(AM.s0 - 0.01, AM.y + 0.005, z * AM.z, 0.03, 0.17, 0.2)]), F.yellow()));
  }
  // auxiliary power generation system (AlliedSignal, now Honeywell; ≈ 120 kg in all): the G250 APU in the left wing
  // root between its upper-surface inlet and exhaust doors, the turbine power module on its gearbox, and the
  // stored-energy system's air and fuel bottles under the large upper panel between the engines (T.O. 00-105E-9)
  {
    const A = FR.APU, ax = (A.s0 + A.s1) / 2, ay = A.y, az = A.z;
    const g = [FR.cylX(A.s0 + 0.24, ay, az, 0.36, 0.13, 0.14, 20), FR.cylX(A.s1 - 0.13, ay, az, 0.22, 0.14, 0.11, 20)];   // compressor / combustor / turbine
    g.push(FR.boxS(A.s0 + 0.04, ay - 0.02, az + 0.07, 0.1, 0.2, 0.17));                                                   // gearbox and starter-generator pad
    // turbine power module on the gearbox (runs on SES air and fuel to start the APU and power the jet in an emergency)
    g.push(FR.cylX(A.s0 + 0.03, ay + 0.1, az + 0.17, 0.12, 0.055, 0.05, 12));
    P('Auxiliary power unit (APU)', {
      system: 'Electrical', material: 'Honeywell (AlliedSignal) G250 gas turbine, 335 kW (450 hp), with turbine power module', mass: 70,
      explode: [0.2, 0.9, -1.3],
      desc: 'A 335 kW (450 hp) gas turbine in the left wing root, between its inlet and exhaust doors in the upper surface (T.O. 00-105E-9), that gives the F-22 autonomous ground starts and can restart the engines at subsonic speed up to 41,000 ft. A turbine power module on its gearbox, run on air and fuel from the stored-energy system, starts it; the T.O. lists about 5 US gal of fuel in the APU system (envelope ≈ 0.6 × 0.3 m, estimate).',
    }, mesh(merge(g), F.boxLight()));
    // inlet duct from the upper inlet door down and aft to the compressor; exhaust up from the turbine to its door;
    // the turbine power module's exhaust down to the left lower wing root ("SES exhaust", T.O.)
    const [i0, i1] = A.inlet, [e0, e1] = A.exhaust;
    const d = [rectTube([[(i0 + i1) / 2, FR.topAt((i0 + i1) / 2, -az) - 0.05, az + 0.08], [i1 + 0.02, FR.topAt(i1, -az) - 0.1, az + 0.06], [A.s0 + 0.04, ay + 0.17, az], [A.s0 + 0.08, ay + 0.13, az]], 0.09, 0.16, { n: 10, up: [0, 0, 1] })];
    d.push(FR.pipe([[A.s1 - 0.02, ay, az], [A.s1 + 0.02, ay + 0.06, az - 0.01], [(e0 + e1) / 2 + 0.12, FR.topAt((e0 + e1) / 2 + 0.12, -az) - 0.11, az + 0.03], [(e0 + e1) / 2 + 0.08, FR.topAt((e0 + e1) / 2 + 0.08, -az) - 0.075, az + 0.03]], 0.065, 12, 10));   // (ending just under the skin, at the exhaust door)
    d.push(FR.pipe([[A.s0 + 0.03, ay + 0.1, az + 0.12], [A.s0 + 0.12, ay - 0.08, az - 0.12], [A.SESX[0] - 0.05, A.SESX[1] + 0.05, A.SESX[2] + 0.06], [A.SESX[0], A.SESX[1], A.SESX[2]]], 0.03, 8, 16));
    P('APU inlet & exhaust ducts', {
      system: 'Electrical', material: 'Titanium exhaust ducts, composite inlet duct', mass: 8,
      explode: [0.2, 1.3, -1.75],
      desc: 'A 450 hp turbine needs its own air: a short duct from a flush inlet door in the upper surface of the left wing root down to the compressor, and a titanium exhaust duct up to a door just behind it, where crews see it open on the ground. A small duct takes the turbine power module\'s exhaust down to a port in the lower wing root, the "SES exhaust" the T.O. warns is extremely hot during APU starts (positions from the T.O. panel maps, routing approximate).',
    }, mesh(merge(d), F.tiDull()));
    const dIn = slab(toothedGrid((sv, u) => { const zz = -lerp(1.56, 1.84, u); return [X(sv), FR.topAt(sv, Math.abs(zz)) + 0.003, zz]; }, [i0, (i0 + i1) / 2, i1], { width: 0.28 }), () => [0, -0.015, 0], V(0, 1, 0));
    // exhaust door: the diamond in the NAWDC top view
    const dm = (e0 + e1) / 2, dpt = ([sv, zz]) => [X(sv), FR.topAt(sv, Math.abs(zz)) + 0.003, zz];
    const dEx = slab([[dpt([e0, -1.6]), dpt([dm, -1.45])], [dpt([dm, -1.75]), dpt([e1, -1.6])]], () => [0, -0.015, 0], V(0, 1, 0));
    P('APU inlet & exhaust doors', {
      system: 'Skin & fairings', skin: true, material: 'Composite flush doors, saw-tooth edges', mass: 3, count: 2,
      explode: [0.2, 1.75, -2.05],
      desc: 'Flush doors in the upper surface of the left wing root keep both APU openings closed, and stealthy, except while the APU runs: the saw-toothed inlet door (T.O. panel #4263) and the diamond-shaped exhaust door behind it (#4289). The T.O. warns that their edges are very sharp and the exhaust very hot; the doors are worked by air from the stored-energy system.',
    }, mesh(merge([dIn, dEx]), F.door()));
    // stored-energy system under the upper panel between the engines (T.O. panel #4336): two high-pressure air
    // bottles and a fuel bottle, a start / control valve, and lines forward over the left duct to the turbine power
    // module on the APU's gearbox
    const SE = FR.SES, b = [], l = [];
    const yb = (sv) => FR.topAt(sv, 0.13) - 0.1;
    for (const zz of [0.13, -0.13]) b.push(new THREE.CapsuleGeometry(0.065, (SE.s1 - SE.s0) - 0.2, 4, 14).rotateZ(Math.PI / 2).translate(X((SE.s0 + SE.s1) / 2 + 0.03), yb(SE.s1), zz));
    b.push(new THREE.CapsuleGeometry(0.05, 0.16, 4, 12).rotateZ(Math.PI / 2).translate(X(SE.s0 - 0.17), yb(SE.s0) + 0.01, -0.13));          // SES fuel bottle
    b.push(FR.boxS(SE.s0 - 0.17, yb(SE.s0) + 0.01, 0.13, 0.12, 0.08, 0.08));                                                                // start / control valve
    // along the spine corridor 3.5 cm under the upper skin (z −0.2 / −0.245), then out over the left duct to the APU
    const run = (zz, y0) => [[SE.s0 - 0.1, y0, zz], [11.9, FR.topAt(11.9, -zz) - 0.035, zz], [11.2, FR.topAt(11.2, -zz) - 0.035, zz], [10.75, FR.topAt(10.75, -zz) - 0.035, zz], [10.55, FR.topAt(10.55, 1.0) - 0.035, -1.0 + zz + 0.2], [A.s0 + 0.1, FR.topAt(A.s0 + 0.1, 1.45) - 0.05, -1.45 + zz + 0.2], [A.s0 + 0.04, ay + 0.15, az + 0.17 + zz + 0.2]];
    l.push(FR.pipe(inside(run(-0.2, yb(SE.s0) + 0.01).map((p, k) => (k === 0 ? [SE.s0 - 0.26, p[1], -0.13] : p)), 0.03), 0.012, 6, 50));
    l.push(FR.pipe(inside([[SE.s0 - 0.11, yb(SE.s0) + 0.01, 0.13], [SE.s0 - 0.13, yb(SE.s0) + 0.03, 0.0], [SE.s0 - 0.15, yb(SE.s0) + 0.03, -0.245], ...run(-0.245, yb(SE.s0) + 0.03).slice(1)], 0.03), 0.012, 6, 50));
    for (const zz of [0.13, -0.13]) l.push(FR.pipe([[SE.s0 + 0.03, yb(SE.s1), zz], [SE.s0 - 0.08, yb(SE.s0) + 0.01, zz > 0 ? 0.1 : 0.09], [SE.s0 - 0.11, yb(SE.s0) + 0.01, 0.12]], 0.01, 6, 6));
    P('Stored-energy system (SES)', {
      system: 'Electrical', material: 'High-pressure air bottles and a fuel bottle, start / control valve, lines to the turbine power module', mass: 30,
      explode: [-0.6, 1.4, 0],
      desc: 'Two high-pressure air bottles and a fuel bottle under the large upper panel between the engines (T.O. 00-105E-9, panel #4336) feed the turbine power module on the APU gearbox, which starts the APU and gives the jet a self-start capability; the same air works the APU doors and lowers the landing gear in an emergency. In flight the 75 kW stored-energy system has to come on line within 5 s at any altitude, airspeed and attitude to keep the flight controls, hydraulics and computers alive if both engines fail.',
    }, [mesh(merge(b), F.orange()), mesh(merge(l), F.pipe())]);
    // (on the left, outboard of the fuel dump line that runs aft along the keel web)
    const zc = -0.2;
    const c = [FR.boxS(SE.s1 + 0.1, yb(SE.s1), zc, 0.18, 0.1, 0.12), FR.cylX(SE.s1 + 0.23, yb(SE.s1), zc, 0.08, 0.04, 0.04, 12)];
    c.push(FR.pipe([[SE.s1 + 0.01, yb(SE.s1), zc - 0.02], [SE.s1 - 0.05, yb(SE.s1), -0.13]], 0.01, 6, 4));
    P('SES air re-charge compressor', {
      system: 'Electrical', material: 'Electrically driven high-pressure air compressor', mass: 12,
      explode: [-1.1, 1.65, 0],
      desc: 'Just behind the bottles, it refills the stored-energy air bottles on board, part of the plan to make the F-22 independent of ground carts for starting and servicing (position approximate).',
    }, mesh(merge(c), F.boxLight()));
    // start air from the APU's load compressor to each AMAD's air turbine starter (the T.O. bottom view shows the
    // starters' exhaust screens): down inboard of the left gear well, across under the inlet ducts behind the
    // ammunition container, then aft along the inboard side of each AMAD
    const xs = RT.cross, sz = RT.startZ;
    // (down ahead of the left main-gear well's front wall, then aft under the duct inboard of the well)
    const sp = [FR.pipe([[A.s1 - 0.12, ay - 0.13, az + 0.02], [A.s1 + 0.02, -0.3, -1.45], [10.93, -0.47, -1.17], [10.935, -0.58, -0.9], [xs, RT.startY, -0.72], [xs, RT.startY, -sz - 0.03]], 0.035, 8, 30)];
    for (const side of [1, -1]) sp.push(FR.pipe([[xs, RT.startY, -sz - 0.03], ...(side > 0 ? [[xs, RT.startY, sz - 0.03]] : []), [xs + 0.08, -0.7, side * sz], [AM.s0 + 0.1, -0.86, side * sz], [AM.s1 + 0.02, -0.88, side * sz], [AM.s1 + 0.06, AM.y - 0.01, side * (AM.z - 0.13)]], 0.033, 8, 30));
    P('APU start path to AMADs', {
      system: 'Electrical', material: 'Insulated start-air ducting', mass: 10,
      explode: [-0.2, -1.45, 0],
      desc: 'Compressed air from the APU spins the air turbine starter on each airframe-mounted accessory drive (the T.O. shows the starters\' exhaust screens in the belly), which turns that engine up for a start on the ground or a relight in flight up to 41,000 ft (routing approximate).',
    }, mesh(merge(sp), F.tiDull()));
  }
  P('Battery & charger/controller (BCCS)', {
    system: 'Electrical', material: 'Sealed lead-acid (sulphuric-acid gel) battery and charger/controller, 28 V DC', mass: 30, count: 2,
    explode: [0.4, -0.9, -0.9],
    desc: 'The battery and charger/controller system sits behind the left avionics-bay door under the cockpit, with its disconnect just aft of the battery (T.O. 00-105E-9, door #4135); it starts the APU and holds essential 28 V DC loads for a short time if all generation is lost. The T.O. lists about 10 lb of battery acid gel.',
  }, mesh(merge(((bs, by, bz) => [
    box(bs, by, bz, 0.3, 0.16, 0.18),                                     // battery
    box(bs - 0.22, by + 0.01, bz, 0.14, 0.12, 0.16),                      // charger / controller ahead of it
    box(bs + 0.175, by + 0.02, bz + 0.03, 0.05, 0.07, 0.07),              // disconnect just aft of the battery
    box((bs - 0.29 + 4.925) / 2, by - 0.085, bz, 4.925 - (bs - 0.29), 0.01, 0.16),   // tray, bolted to the frame at 4.94
  ])(...RT.battery)), F.box()));
  P('Aft power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers and contactors', mass: 30, count: 2,
    explode: [-0.4, -1.05, 0],
    desc: 'Beside the keel between the engine fronts, they take each generator\'s 270 V DC output, switch it onto the buses and protect the aft loads (location approximate).',
  }, mesh(merge([box(RT.aftPdc[0], RT.aftPdc[1], RT.aftPdc[2], 0.4, 0.12, 0.1), box(RT.aftPdc[0], RT.aftPdc[1], -RT.aftPdc[2], 0.4, 0.12, 0.1)]), F.box()));
  P('Forward power distribution centres', {
    system: 'Electrical', material: 'Solid-state power controllers, circuit-breaker-free', mass: 40, count: 2,
    explode: [0.5, -0.65, 0],
    desc: 'In the avionics bays either side of the nose-wheel well under the cockpit, they feed the avionics, cockpit and forward loads; solid-state controllers replace most circuit breakers and can reset a fault from the cockpit.',
  }, mesh(merge([box(RT.fwdPdc[0], RT.fwdPdc[1], RT.fwdPdc[2], 0.6, 0.2, 0.12), box(RT.fwdPdc[0], RT.fwdPdc[1], -RT.fwdPdc[2], 0.6, 0.2, 0.12)]), F.box()));
  P('Converter-regulators (270 V → 28 V DC)', {
    system: 'Electrical', material: 'Solid-state DC–DC converters', mass: 20, count: 2,
    explode: [0.6, -1.2, 0.5],
    desc: 'Step the 270 V DC primary power down to 28 V DC for the many standard-voltage loads (lights, valves, older equipment); inverters supply the few AC loads.',
  }, mesh(merge([box(RT.conv[0], RT.conv[1], RT.conv[2], 0.24, 0.18, 0.11), box(RT.conv[0], RT.conv[1], -RT.conv[2], 0.24, 0.18, 0.11)]), F.boxLight()));
  {
    const g = [];
    const hz = RT.sill.harness;
    for (const z of [1, -1]) {
      // forward PDC → off its aft face, outboard of the converter, down under the vapour-cycle pack into the corridor
      // beside the nose well, aft under F-1A outboard of the ECS bay, outboard through the gap ahead of the main
      // bay's front wall, along the main-bay sill, over the ammunition container and inboard behind it, under the
      // inlet duct to the aft distribution centre
      const NH = RT.nose.harness, pd = RT.fwdPdc, D = RT.nose.descend;
      // 270 V feed back to the converter-regulators just behind the distribution centre
      g.push(FR.pipe([[pd[0] + 0.28, pd[1] - 0.06, z * pd[2]], [pd[0] + 0.33, pd[1] - 0.065, z * pd[2]], [RT.conv[0] - 0.1, RT.conv[1], z * RT.conv[2]]], 0.014, 6, 4));
      // forward loads: to the IFDL processor (right) and the aft VMS box (left) ahead of it
      g.push(FR.pipe(z > 0 ? [[pd[0] - 0.29, pd[1], pd[2]], [3.75, pd[1] + 0.02, pd[2]], [3.62, -0.25, 0.42]] : [[pd[0] - 0.29, pd[1], -pd[2]], [3.2, -0.25, -0.41], [3.03, -0.18, -0.41], [2.99, -0.165, -0.405]], 0.018, 6, 8));
      g.push(FR.pipe([[pd[0] + 0.28, pd[1] - 0.03, z * (pd[2] + 0.04)], [pd[0] + 0.32, pd[1] - 0.04, z * 0.5], [D[0], -0.36, z * 0.52], [D[1], NH[1], z * 0.53],
        [RT.nose.rise, NH[1], z * 0.52], [6.1, NH[1], z * NH[0]], [RT.nose.slot - 0.05, NH[1], z * NH[0]], [RT.nose.slot, NH[1] + RT.nose.slotDrop, z * 0.75], [RT.nose.slot + 0.02, NH[1] + RT.nose.slotDrop, z * 0.98], [7.05, -0.69, z * 1.0], [7.15, hz[1], z * hz[0]], [9.0, hz[1], z * hz[0]],
        // (inboard behind the ammunition container under the APU start-air crossing, then below the bleed duct's aft run)
        [FR.MAIN_BAY.s1, hz[1], z * hz[0]], ...inside([[FR.AMMO.s1 + 0.04, -0.69, z * 1.01], [RT.cross - 0.05, -0.72, z * 0.7], [RT.cross + 0.01, -0.78, z * 0.42], [RT.cross + 0.13, -0.78, z * 0.2], [RT.cross + 0.33, -0.74, z * 0.12]], 0.025), [RT.aftPdc[0] - 0.24, RT.aftPdc[1], z * RT.aftPdc[2]], [RT.aftPdc[0] - 0.2, RT.aftPdc[1], z * RT.aftPdc[2]]], 0.018, 6, 110));
      // generator feeders: from each generator back to its distribution centre
      g.push(FR.pipe([[AM.s0 - 0.27, AM.y + 0.005, z * AM.z], [AM.s0 - 0.24, -0.8, z * 0.48], [RT.cross + 0.2, -0.81, z * 0.24], [RT.cross + 0.36, -0.77, z * 0.15], [RT.aftPdc[0] - 0.24, RT.aftPdc[1] - 0.03, z * RT.aftPdc[2]]], 0.012, 6, 20));
      g.push(FR.pipe([[RT.aftPdc[0] + 0.2, RT.aftPdc[1], z * RT.aftPdc[2]], [13.0, RT.aftPdc[1], z * RT.aftPdc[2]], [15.0, RT.aftPdc[1], z * RT.aftPdc[2]], [15.42, -0.46, z * 0.07]], 0.016, 5, 20));             // aft loads (to the tail-cone equipment)
    }
    P('Main wiring harnesses', {
      system: 'Electrical', material: 'Shielded copper harnesses in conduits', mass: 120,
      explode: [0.3, -0.35, 0],
      desc: 'Two separated harness runs, one down each side, link the generators, distribution centres and loads; keeping them apart means one hit cannot cut both.',
    }, mesh(merge(g), F.box()));
  }

  // ================================================================== environmental control & thermal management
  {
    // engine bleed air: from a port on each HP compressor case, through the shut-off and pressure-regulating valves,
    // forward under the engine inboard of the accessory drive, across behind the ammunition container, along the
    // main-bay sill and in ahead of the bay to the heat exchangers in the ECS bay
    const E = FR.ECS_BAY, BL = RT.sill.bleed, xb = RT.bleedCross;
    const g = [], vb = [];
    for (const side of [1, -1]) {
      const z = side, ez = FR.ENG_Z * side, ey = FR.ENG_Y;
      const dir = new THREE.Vector2(side * 0.3 - ez, -0.6 - ey).normalize();
      const port = [12.67, ey + dir.y * 0.3, ez + dir.x * 0.3];
      g.push(FR.pipe([port, [12.66, ey + dir.y * 0.5, ez + dir.x * 0.5], [12.6, -0.7, z * 0.26], [12.3, -0.74, z * 0.24], [11.9, -0.75, z * 0.235], [11.45, -0.74, z * 0.23], [xb + 0.06, RT.bleedY, z * 0.24],
        [xb, RT.bleedY, z * 0.6], [xb - 0.02, RT.bleedY, z * 0.97], [FR.AMMO.s0 + 0.02, RT.bleedY + 0.05, z * 0.99], [FR.MAIN_BAY.s1 - 0.05, BL[1], z * BL[0]], [9.0, BL[1], z * BL[0]], [7.1, BL[1], z * BL[0]],
        // (down under the duct's floor where it comes down behind the inlet, over the other through-runs, which drop
        // further at the slot, then up inboard of the duct and in over the nose lanes)
        [7.02, -0.545, z * 1.07], [6.95, -0.585, z * 1.02], [RT.nose.slot + 0.018, -0.595, z * 0.9], [RT.nose.slot + 0.015, -0.595, z * 0.7], [RT.nose.slot + 0.01, -0.55, z * 0.6], [RT.nose.slot + 0.003, RT.nose.bleedY, z * 0.56], [E.s1 - 0.02, -0.5, z * 0.4], [E.hx[0] + 0.15, E.hx[1] + 0.06, z * E.hx[2]]], 0.03, 8, 120));
      vb.push(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 14).rotateZ(Math.PI / 2).translate(X(12.45), -0.73, z * 0.245));      // shut-off valve
      vb.push(FR.boxS(12.45, -0.665, z * 0.245, 0.07, 0.06, 0.06));
      vb.push(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 14).rotateZ(Math.PI / 2).translate(X(12.05), -0.75, z * 0.235));     // pressure-regulating valve
      vb.push(FR.boxS(12.05, -0.69, z * 0.235, 0.06, 0.06, 0.06));
    }
    // conditioned air to the OBOGS concentrator, tapped after the air-cycle machine, up beside the nose well
    {
      const OB = RT.nose.obogs, sR = RT.nose.rise - 0.015, bh = 5.46 + 0.0125;
      // (outboard of the conditioned-air duct, which leaves the machine's front end below it)
      g.push(FR.pipe([[E.acm[0] - 0.12, E.acm[1] + 0.1, -0.05], [E.acm[0] - 0.16, OB[1], -0.2], [E.acm[0] - 0.2, OB[1], -OB[0]], [5.7, OB[1], -OB[0]], [sR + 0.03, OB[1] + 0.03, -OB[0]], [sR, -0.3, -OB[0]], [sR, 0.0, -OB[0]], [sR - 0.03, 0.05, -0.49], [bh + 0.002, 0.06, -0.46]], 0.016, 6, 30));
      // inside the cockpit: from the bulkhead fitting forward along the tub's aft wall to the concentrator
      g.push(FR.pipe([[5.395, 0.1, -0.42], [5.33, 0.1, -0.41], [5.27, 0.11, -0.39]], 0.012, 6, 6));
    }
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
      desc: 'Bleed air is first cooled in heat exchangers in the ECS bay between the inlets, ahead of the main weapons bay; with so few cooling inlets on a stealthy airframe, much of the heat goes into the fuel rather than into ram air (positions approximate).',
    }, mesh(merge([box(E.hx[0] + 0.01, E.hx[1], E.hx[2], 0.3, 0.24, 0.18), box(E.hx[0] + 0.01, E.hx[1], -E.hx[2], 0.3, 0.24, 0.18)]), F.copper()));
    P('Air-cycle machine & water separator', {
      system: 'Environmental control', material: 'Turbine / compressor air-cycle machine, water separator', mass: 55,
      explode: [0.4, -1.5, 0],
      desc: 'Expanding the cooled bleed air through a turbine drops its temperature far below ambient; a water separator dries it before it goes to the cockpit and the air-cooled avionics (position approximate).',
    }, mesh(merge([FR.cylX(E.acm[0], E.acm[1], 0, 0.36, 0.12, 0.1, 18), FR.cylX(E.acm[0] - 0.24, E.acm[1], 0, 0.12, 0.075, 0.075, 14),
      ...[1, -1].map((side) => FR.pipe([[E.hx[0] - 0.13, E.hx[1], side * E.hx[2]], [E.acm[0] + 0.14, E.acm[1] + 0.02, side * 0.08], [E.acm[0] + 0.12, E.acm[1], side * 0.02]], 0.035, 8, 8))]), F.boxLight()));
    const d = [];
    // conditioned air: from the air-cycle machine's outlet up under F-1A's floor and forward on top of the corridor
    // beside the nose well, then up behind the aft cockpit bulkhead to the inlet fittings on it; on the right a
    // branch runs forward outboard of the vapour-cycle pack and under the cockpit floor to the avionics bay
    const NA = RT.nose.air, sR = RT.nose.rise, bh = 5.46 + 0.0125;
    for (const side of [1, -1]) {
      d.push(FR.pipe([[E.acm[0] - 0.29, E.acm[1] + 0.03, side * 0.05], [E.acm[0] - 0.265, NA[1] - 0.03, side * 0.12], [6.19, NA[1], side * 0.3], [6.1, NA[1], side * NA[0]], [5.75, NA[1], side * NA[0]],
        [sR + 0.04, NA[1] + 0.02, side * NA[0]], [sR, NA[1] + 0.1, side * NA[0]], [sR, 0.04, side * NA[0]], [sR - 0.03, 0.13, side * (NA[0] - 0.02)], [bh + 0.002, 0.15, side * (NA[0] - 0.04)]], 0.035, 8, 40));
    }
    d.push(FR.pipe([[sR, -0.14, NA[0]], [sR - 0.01, -0.15, 0.6], [5.35, -0.15, 0.645], [4.7, -0.15, 0.645], [4.45, -0.1, 0.54], [4.3, -0.09, 0.5], [3.3, -0.09, 0.47], [FR.AV_BAY.s1 + 0.01, -0.1, 0.42]], 0.03, 8, 40));
    {
      const v = [new THREE.CylinderGeometry(0.075, 0.075, 0.06, 18).rotateZ(Math.PI / 2).translate(X(SM(6.94)), 0.1, 0.3)];
      v.push(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14).rotateZ(Math.PI / 2).translate(X(SM(6.94)), 0.1, -0.3));
      v.push(FR.boxS(SM(6.95), 0.0, -0.3, 0.05, 0.08, 0.07));
      // canopy-seal air: from the regulator up the bulkhead to the sill
      // (behind the aft pressure bulkhead and outboard of the tub's side wall, through the bulkhead to the sill)
      const sl = SM(6.7), sw = FR.sillW(sl);
      const l = [FR.pipe([[SM(6.94), 0.06, -0.3], [SM(6.95) + 0.005, 0.18, -0.46], [5.44, 0.32, -Math.max(0.51, sw - 0.02)], [sl, FR.upperA(sl, sw) - 0.04, -(sw - 0.03)]], 0.008, 5, 10)];
      P('Cockpit pressure regulator & outflow valve', {
        system: 'Environmental control', material: 'Pressure-regulating outflow valve, safety valve, canopy-seal pressure regulator', mass: 6,
        explode: [-0.6, 1.0, 0],
        desc: 'Conditioned air flows into the cockpit and out through this outflow valve on the aft pressure bulkhead, which opens and closes to hold the cabin-pressure schedule; a regulator beside it feeds air to inflate the canopy seal against the sill (positions approximate).',
      }, [mesh(merge(v), F.boxLight()), mesh(merge(l), F.pipe())]);
    }
    P('Cockpit & avionics air ducts', {
      system: 'Environmental control', material: 'Composite and aluminium ducting', mass: 15,
      explode: [0.5, -0.4, 0.2],
      desc: 'Carry conditioned air up beside the nose-wheel well to the cockpit outlets and the canopy demist, and forward through the avionics bays, and keep the cockpit pressurised (routing approximate).',
    }, mesh(merge(d), F.duct()));
  }
  P('OBOGS oxygen concentrator', {
    system: 'Environmental control', material: 'Molecular-sieve oxygen concentrator', mass: 18,
    explode: [0.2, 1.05, -0.6],
    desc: 'The on-board oxygen generation system passes conditioned engine bleed air through molecular-sieve beds that hold back nitrogen, giving the pilot breathing oxygen without liquid-oxygen servicing. Its product gas goes to the BRAG valve on the seat.',
  }, mesh(box(SM(6.6), 0.18, -0.37, 0.24, 0.22, 0.16), F.boxLight()));
  {
    // fire protection: extinguisher bottles on the keel between the engine fronts, a spray main aft along each engine
    // bay's inboard top (inside the bay, under the spine) with spray tubes over the engine, and continuous detector
    // loops along the top and bottom of each bay, 62 cm off the engine's axis (the bay's wall, FR.ENG_Z / ENG_Y, is
    // ≈ 66 cm off it; the A-1 feed cells fill the space outside it)
    const g = [];
    const sB = SM(13.45);
    for (const z of [0.11, -0.11]) g.push(new THREE.SphereGeometry(0.08, 14, 10).translate(X(sB), 0.36, z));
    const l = [];
    const EY = FR.ENG_Y, rL = 0.62;
    for (const side of [1, -1]) {
      const ez = FR.ENG_Z * side;
      // (the main runs along the keel side, under the oil tank and its lube lines on the engine's inboard top; the
      // spray tubes branch off behind them, over the turbine and augmentor cases)
      l.push(FR.pipe([[sB, 0.36, side * 0.18], [sB + 0.15, 0.34, side * 0.13], [13.0, 0.33, side * 0.12], [14.205, 0.305, side * 0.12]], 0.01, 5, 24));
      l.push(FR.pipe([[13.65, 0.315, side * 0.12], [13.69, 0.4, side * 0.35], [13.72, 0.43, side * 0.5]], 0.008, 5, 8));
      l.push(FR.pipe([[14.2, 0.305, side * 0.12], [14.24, 0.38, side * 0.33], [14.26, 0.405, side * 0.44]], 0.008, 5, 8));
    }
    const dl = [];
    for (const side of [1, -1]) {
      const ez = FR.ENG_Z * side;
      const sL = Math.min(SM(17.05), FR.S_BE - 0.08), s0 = 11.88, sB0 = 12.99;
      // (kept 3 cm under the upper skin, which comes down below the bay's top aft)
      const at = (deg, top, s = s0, r = rL) => { const a = (deg * Math.PI) / 180, z = ez + side * r * Math.sin(a); return [Math.min(EY + (top ? 1 : -1) * r * Math.cos(a), FR.topAt(s, Math.abs(z)) - 0.03), z]; };
      for (const [deg, top] of [[50, true], [-50, true], [35, false], [-40, false]]) {
        // (the bottom loops start at the 13.02 frame, behind the gearbox, its fuel pumps and the feed line's way into the bay)
        dl.push(FR.pipe([top ? s0 : sB0, top ? 12.6 : 13.3, 13.6, 14.6, sL].map((s) => { const [y, z] = at(deg, top, s); return [s, y, z]; }), 0.006, 5, 16));
      }
      for (const top of [true, false]) for (const s of [top ? s0 : sB0, sL]) {
        const ds = top ? [-50, -25, 0, 25, 50] : [-40, -20, 0, 17.5, 35];   // between the two longitudinal loops of that side
        // (the front bottom loop passes between the case and the augmentor fuel line coming off the gearbox)
        const r = !top && s === sB0 ? 0.616 : rL;
        dl.push(FR.pipe(ds.map((d) => { const [y, z] = at(d, top, s, r); return [s, y, z]; }), 0.006, 5, 10));
      }
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
    // dry-bay fire suppression: canisters in the gun bay (right) and the APU bay (left) beside the fuel cells (in the
    // APU bay ahead of and outboard of the APU's inlet duct, under the upper skin)
    const d = [];
    for (const [s, z, y] of [[9.1, 1.78, -0.26], [10.03, 1.82, -0.24], [9.6, -1.6, FR.topAt(9.6, 1.6) - 0.037], [10.0, -1.95, FR.topAt(10.0, 1.95) - 0.037]]) d.push(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8).rotateZ(Math.PI / 2).translate(X(s), y, z));
    P('Dry-bay fire suppression', {
      system: 'Environmental control', material: 'Fast-acting suppressant canisters with optical fire detectors', mass: 10, count: 4,
      explode: [0, 1.75, 0.5],
      desc: 'Small canisters in the dry bays beside the fuel cells — the gun bay and the APU bay in the wing roots — fire within milliseconds of an optical sensor seeing a flash from a hit, smothering a fire before it can grow (positions approximate).',
    }, mesh(merge(d), F.orange()));
  }
  return { tanks };
}
